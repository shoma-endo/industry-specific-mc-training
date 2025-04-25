// lib/queries.ts
import { groq } from 'next-sanity';

export const landingPageQuery = groq`
  *[_type == "landingPage"][0]{
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

export const liteWordQuery = groq`
  *[_type == "liteWord"][0]{
    hero { title, subtitle, "backgroundImageUrl": backgroundImage.asset->url },
    features[]{ title, description, icon },
    samples[]{ title, "imageUrl": image.asset->url, url },
    ctaForm { heading, description, fields, submitLabel },
    faq[]{ question, answer },
    footerLinks[]{ label, url }
  }
`;

// landingPage を slug ごとに取得するクエリ
export const landingPageBySlugQuery = groq`
  *[_type == "landingPage" && slug.current == $slug][0]{
    hero { title, subtitle, "backgroundImageUrl": backgroundImage.asset->url },
    features[]{ title, description, icon },
    samples[]{ title, "imageUrl": image.asset->url, url },
    ctaForm { heading, description, fields, submitLabel },
    faq[]{ question, answer },
    footerLinks[]{ label, url }
  }
`;
