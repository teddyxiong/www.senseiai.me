/**
 * Source Tracking Utility
 * Function: Detects the 'f' parameter in the URL and records it with the current timestamp into a Cookie.
 * Also syncs this data to Google Analytics 4 as User Properties if available.
 * 
 * Attribution Model: First Touch
 * Logic: If a valid referral_source cookie already exists, new parameters will be IGNORED.
 * The source is only recorded if the user has no existing source history (or the cookie expired).
 */

// Add type definition for window.gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export const initSourceTracker = () => {
  // Ensure execution only in the client-side browser environment
  if (typeof window === 'undefined') return;

  try {
    const params = new URLSearchParams(window.location.search);
    const newSource = params.get('f');

    // Helper to get existing cookie
    const getExistingRecord = () => {
      const match = document.cookie.match(new RegExp('(^| )referral_source=([^;]+)'));
      if (match) {
        try {
          return JSON.parse(decodeURIComponent(match[2]));
        } catch (e) {
          return null;
        }
      }
      return null;
    };

    const existingRecord = getExistingRecord();

    // 1. Logic: Only write if NO existing record exists (First Touch)
    if (newSource && !existingRecord) {
      const record = {
        source: newSource,
        timestamp: new Date().toISOString(), // Record UTC timestamp
      };

      // Write to Cookie
      // key: referral_source
      // max-age: 2592000 seconds (valid for 30 days)
      // path: / (valid for the entire site)
      // SameSite: Lax (modern browser security standard)
      document.cookie = `referral_source=${encodeURIComponent(JSON.stringify(record))}; path=/; max-age=2592000; SameSite=Lax`;
      
      // Sync to GA4 immediately for the new source
      syncToGA4(record.source, record.timestamp);
    } 
    // 2. If we already have a record (either just written, or existed before), sync it to GA4
    // This ensures GA4 always gets the "First Touch" source on every page load
    else if (existingRecord && existingRecord.source) {
      syncToGA4(existingRecord.source, existingRecord.timestamp);
    }

  } catch (error) {
    console.error('Source tracking error:', error);
  }
};

/**
 * Helper function to send user properties to GA4
 */
const syncToGA4 = (source: string, timestamp: string) => {
  if (typeof window.gtag === 'function') {
    window.gtag('set', 'user_properties', {
      referral_source: source,
      referral_timestamp: timestamp
    });
    // Optional: Log for debugging
    // console.log('GA4 User Properties Synced:', { referral_source: source });
  }
};
