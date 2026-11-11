import emblem from "../assets/brand/emblem.png";

/**
 * The TSSD emblem in its app-icon tile. Decorative: the brand name is always
 * shown beside it or announced separately, so screen readers skip it.
 */
export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden>
      <img src={emblem} alt="" width={19} height={25} />
    </span>
  );
}
