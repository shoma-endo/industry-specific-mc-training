# スタッフ削除済みデータの GCS バックアップからの一部復元

スタッフを削除した後、そのスタッフが作成したチャット・注釈・ブリーフをオーナーに引き継ぐ形で復元する手順です。  
`.github/workflows/supabase-backup.yml` で GCS に保存した週次ダンプを利用します。

## 前提

- 復元したい時点のバックアップが GCS に存在する（スタッフ削除**前**の日付）
- 本番 DB の接続情報（`SUPABASE_DB_URL` 相当）が手元にある
- Node.js 18+ が利用可能
- **復元対象**: `chat_sessions` → `chat_messages` → `content_annotations` の3テーブルのみ（この順で適用。外部キー依存のため順序を変えないこと）

## 手順概要

1. GCS から対象バックアップをダウンロードして解凍する
2. 復元スクリプトで「スタッフ → オーナー」に帰属を付け替えた SQL を生成する
3. 生成した SQL を本番 DB に流し込む

---

## 1. GCS からバックアップを取得

```bash
# 例: バックアップ一覧を確認
gcloud storage ls gs://${GCS_BUCKET_NAME}/supabase-backups/

# 対象日時のデータダンプをダウンロード（例: 20260112T030000Z）
BACKUP_PREFIX="20260112T030000Z"
gcloud storage cp "gs://${GCS_BUCKET_NAME}/supabase-backups/${BACKUP_PREFIX}/${BACKUP_PREFIX}_data.sql.gz" ./
gunzip -k "${BACKUP_PREFIX}_data.sql.gz"
# 解凍後: ${BACKUP_PREFIX}_data.sql
```

---

## 2. 復元用 SQL の生成

### 2.1 スタッフの UUID が分からない場合（オーナーから特定）

スタッフは本番から削除済みでダンプにしかいない場合、**オーナーの UUID** とダンプから該当スタッフを一覧できます。

```bash
OWNER_USER_ID="yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
DATA_SQL="/path/to/20260208T040130Z_data.sql"   # 解凍済みのデータダンプ

node scripts/restore-staff-chats-from-dump.js \
  --dump "$DATA_SQL" \
  --owner-id "$OWNER_USER_ID" \
  --list-staff
```

- 出力: 1行1件で `スタッフのUUID` と（あれば）`line_display_name`。復元したいスタッフの UUID をコピーして 2.2 の `STAFF_USER_ID` に使う。

### 2.2 復元用 SQL の生成

リポジトリの `scripts/restore-staff-chats-from-dump.js` で、スタッフの `user_id` をオーナーの `user_id` に置き換えた復元用 SQL を出力します。

```bash
# スタッフの UUID とオーナーの UUID を指定する
STAFF_USER_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   # --list-staff で取得した値
OWNER_USER_ID="yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
DATA_SQL="${BACKUP_PREFIX}_data.sql"

node scripts/restore-staff-chats-from-dump.js \
  --dump "$DATA_SQL" \
  --staff-id "$STAFF_USER_ID" \
  --owner-id "$OWNER_USER_ID" \
  > restore_owner_$(date +%Y%m%d).sql
```

- **スタッフの UUID**: 削除したスタッフの `users.id`（`--list-staff` で取得するか、管理画面等で確認した値）
- **オーナーの UUID**: 引き継ぎ先オーナーの `users.id`（現在ログインしているオーナー）

生成される SQL は次のテーブルのみを対象とします（依存順で出力）。

- `chat_sessions`（`user_id` をオーナーに変更）
- `chat_messages`（上記セッションに属する行の `user_id` をオーナーに変更）
- `content_annotations`（`user_id` をオーナーに変更。一意制約 `(user_id, wp_post_id)` / `(user_id, canonical_url)` によりオーナー側に同一投稿・URLが既にあると衝突するため、スクリプトは同一復元セット内の重複を除外し、適用時は PL/pgSQL で一意制約違反をスキップする）

※ `users` テーブルは復元しません。オーナーに「引き継がれたコンテンツ」としてのみ復元します。

---

## 3. 本番 DB への適用

**必ず事前にバックアップを取得するか、PITR が有効であることを確認してください。**

### 3.1 事前確認

実行前に、流し込む SQL の内容と接続先を確認します。

```bash
# 生成 SQL の対象テーブル・行数を確認（実行せずファイルのみ参照）
grep -E "^(INSERT|COPY)" restore_owner_YYYYMMDD.sql | head -20

# 本番適用前に、ステージング等で同じ SQL を試す場合は --echo-all でどの文が流れるか確認できる
# psql "$STAGING_DB_URL" --echo-all -f restore_owner_YYYYMMDD.sql
```

- `--echo-all`: 実行する各コマンドをエコーする。ステージングで試すときに有用。
- 本番接続前に、別の DB（ステージングなど）で同じ SQL を試すことを推奨します。

### 3.2 トランザクション内での実行

SQL の適用は必ずトランザクション内で行い、エラー時は ROLLBACK してから原因を確認してください。

```bash
# トランザクション内で実行（エラーがなければ COMMIT、エラーがあれば ROLLBACK して再確認）
# -v ON_ERROR_STOP=1 により SQL エラー時に psql が非ゼロで終了し、$? で失敗を検知できる
psql -v ON_ERROR_STOP=1 "$SUPABASE_DB_URL" << 'EOF'
BEGIN;
\i restore_owner_YYYYMMDD.sql
-- ここまでエラーがなければコミット
COMMIT;
EOF
```

- 上記のまま実行してエラーが出た場合、psql はトランザクションを自動でロールバックした状態で終了し、終了コードは非ゼロになります。  
  再度接続し、**該当 SQL を修正するか「主キー衝突の対処」に従ってから**同じ手順をやり直してください。
- ファイルパスは `\i` 実行時のカレントディレクトリからの相対パス、または絶対パスで指定してください（例: `\i /path/to/restore_owner_YYYYMMDD.sql`）。

### 3.3 主キー衝突が発生した場合の具体的対処

既に同じ主キー（`id`）の行が本番に存在する場合、INSERT が失敗します。以下の手順で衝突行を特定し、復元 SQL から除外するか既存データと突き合わせてから再実行してください。

1. **エラーメッセージで衝突したテーブル・制約名を確認**  
   例: `ERROR: duplicate key value violates unique constraint "chat_sessions_pkey"` → `chat_sessions` の `id` が衝突。

2. **復元 SQL 内の該当 INSERT の主キー値を抽出**  
   ```bash
   # 例: chat_sessions の INSERT 行から id（UUID）を確認
   grep "INSERT INTO.*chat_sessions" restore_owner_YYYYMMDD.sql
   # 出力された VALUES (...) の先頭の引用符で囲まれた UUID が主キー
   # COPY 形式の場合は、該当テーブルのブロック内で先頭列（id）の値を確認
   ```

3. **本番 DB で既存行との比較**  
   ```sql
   -- 衝突した id が本番に存在するか確認
   SELECT id, user_id, created_at FROM chat_sessions WHERE id = '衝突した-UUID';
   ```  
   - 既存行の `user_id` がオーナーで内容が同じであれば、その行は復元不要（復元 SQL から該当 INSERT を削除して再実行）。
   - 既存行が別ユーザーや古いデータの場合は、業務上どちらを正とするか判断し、必要なら本番の該当行を削除してから復元 SQL を再実行するか、復元 SQL の該当行だけを削除して他だけを流す。

4. **復元 SQL の修正**  
   - 該当する `INSERT INTO ... VALUES (...);` の行を削除する。  
   - または、テーブルごとに `ON CONFLICT (id) DO UPDATE SET ...` に書き換える（意図した上書きになるよう SET 句を設計すること）。

5. **修正後の再実行**  
   再度「3.2 トランザクション内での実行」の手順で、修正した SQL を流し直す。

本番で削除済みのスタッフに紐づく行だけを復元する想定であれば、通常は主キー衝突は発生しません。衝突した場合は、スタッフ削除後に同じ id でオーナーが新規作成したか、別の復元で既に取り込んだ可能性を疑ってください。

### 3.4 実行完了後の成功確認

適用後、以下で復元が意図どおりか確認します。

1. **psql の終了状態**  
   エラーが出ずに `COMMIT` まで進んでいれば、トランザクションはコミット済みです。エラー時は psql が非ゼロで終了するため、`echo $?` で確認できます。

2. **復元件数の確認**  
   流し込んだ SQL の行数と、本番の件数が一致するか確認します。

   ```bash
   # 復元 SQL に含まれる COPY データ行数（テーブルごと）
   # content_annotations は一時表 _restore_content_annotations に COPY される形式
   awk '/^COPY public\.chat_sessions/,/^\\\./ { if ($0 !~ /^COPY|^\\\./) n++ } END { print "chat_sessions:", n+0 }' restore_owner_YYYYMMDD.sql
   awk '/^COPY public\.chat_messages/,/^\\\./ { if ($0 !~ /^COPY|^\\\./) n++ } END { print "chat_messages:", n+0 }' restore_owner_YYYYMMDD.sql
   awk '/^COPY _restore_content_annotations/,/^\\\./ { if ($0 !~ /^COPY|^\\\./) n++ } END { print "content_annotations:", n+0 }' restore_owner_YYYYMMDD.sql
   ```

   ```sql
   -- 本番 DB でオーナーに紐づく件数（復元直後は「元のオーナー分 + 復元分」なので、復元分だけ見る場合は復元前の件数を控えておき差分で確認）
   SELECT 'chat_sessions', COUNT(*) FROM chat_sessions WHERE user_id = 'オーナーの-UUID';
   SELECT 'chat_messages', COUNT(*) FROM chat_messages WHERE user_id = 'オーナーの-UUID';
   SELECT 'content_annotations', COUNT(*) FROM content_annotations WHERE user_id = 'オーナーの-UUID';
   ```

3. **アプリ側での確認**  
   オーナーアカウントでログインし、チャット一覧に復元したセッションが表示されること、該当チャットのメッセージ・注釈が閲覧できることを手動で確認してください。

---

## トラブルシュート

| 現象 | 対処 |
|------|------|
| `COPY` ブロックが検出されない | `pg_dump --data-only` はデフォルトで COPY 形式。`--inserts` で取ったダンプはスクリプト未対応のため、デフォルトのダンプを利用してください。 |
| シーケンスのずれ | 復元後に `SELECT setval(...)` で必要に応じてシーケンスを合わせてください。 |
| 外部キーエラー | 復元順は script で依存順に出力しています。`chat_sessions` → `chat_messages` の順を崩さないでください。 |

---

## ロールバック

復元した行だけを削除したい場合は、生成した SQL に含まれる `id`（セッション ID やメッセージ ID など）を控えておき、手動で `DELETE FROM ... WHERE id IN (...)` を実行してください。  
一括で戻す場合は、Supabase の PITR や別バックアップからのリストアを検討してください。
