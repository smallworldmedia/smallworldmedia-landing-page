/**
 * SiteFooter — Simple site footer (Figma "Footer", simple variant).
 *
 * Near-black bar with the SWM globe mark and the copyright line.
 * The expanded variant with footer nav links exists in the Figma
 * (hidden layer "links footer") — future iteration.
 */
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__bar">
        <img
          className="site-footer__globe"
          src="/icons/swm-globe-mark.svg"
          alt="Small World Media"
          width="43"
          height="41"
        />
        <p className="site-footer__copy">
          ©{new Date().getFullYear()} Small World Media LLC. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
