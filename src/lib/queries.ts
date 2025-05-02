// lib/queries.ts
import { groq } from 'next-sanity';

// ユーザーIDとslugごとにランディングページを取得するクエリ
export const landingPageByUserAndSlugQuery = groq`
  *[_type == "landingPage" && slug.current == $slug && userId == $userId][0]{
    hero {
      title,
      subtitle,
      "backgroundImageUrl": backgroundImage.asset->url
    },
    features[]{
      title,
      description,
      icon
    },
    samples[]{
      title,
      "imageUrl": image.asset->url,
      url
    },
    ctaForm {
      heading,
      description,
      fields,
      submitLabel
    },
    faq[]{
      question,
      answer
    },
    footerLinks[]{
      label,
      url
    }
  }
`;
