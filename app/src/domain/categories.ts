import type { IconName } from "../ui/icons";
import type { FamilyName } from "../theme/tokens";

export interface CategoryStyle {
  icon: IconName;
  family: FamilyName;
}

const STYLES: Record<string, CategoryStyle> = {
  "identity-documents": { icon: "docs", family: "teal" },
  business: { icon: "briefcase", family: "lapis" },
  taxes: { icon: "chart", family: "gold" },
  healthcare: { icon: "heart", family: "pomegranate" },
  "visa-migration": { icon: "plane", family: "teal" },
  transport: { icon: "car", family: "lapis" },
  residence: { icon: "building", family: "gold" },
};

const FALLBACK: CategoryStyle = { icon: "docs", family: "teal" };

/** Icon + colour family for a category slug (unknown slugs fall back to documents/teal). */
export const categoryStyle = (slug: string | undefined): CategoryStyle => (slug && STYLES[slug]) || FALLBACK;
