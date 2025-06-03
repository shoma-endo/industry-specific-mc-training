// Sanity 関連の型定義

export interface LandingPageData {
  _id: string;
  _rev: string;
  _type: 'landingPage';
  _createdAt: string;
  _updatedAt: string;
  hero: {
    title: string;
    subtitle: string;
    backgroundImageUrl: string;
  };
  features:
    | {
        title: string;
        description: string;
        icon: string;
      }[]
    | null;
  samples:
    | {
        url: string;
        imageUrl: string;
        title: string;
      }[]
    | null;
  ctaForm: {
    heading: string;
    description: string;
    fields: string[];
    submitLabel: string;
  } | null;
  faq:
    | {
        question: string;
        answer: string;
      }[]
    | null;
  footerLinks:
    | {
        label: string;
        url: string;
      }[]
    | null;
  slug: {
    current: string;
    _type: 'slug';
  };
  userId: string;
}

export interface SanityProject {
  projectId: string;
  dataset: string;
}
