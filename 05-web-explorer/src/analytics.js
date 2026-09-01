// Optional analytics. This module does nothing unless a GA4 measurement ID is
// supplied at build time, for example:
//   VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX npm run build
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

if (MEASUREMENT_ID) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  const googleTag = document.createElement('script');
  googleTag.async = true;
  googleTag.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.append(googleTag);

  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  });
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, {
    page_title: document.title,
    page_location: location.href,
    send_page_view: true,
  });
}
