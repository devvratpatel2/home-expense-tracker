/** @type {import('next').NextConfig} */
const nextConfig = {
  // Shared expense links carry their access code in the URL, so keep it out of
  // search engines and out of the Referer header sent to other sites.
  async headers() {
    return [
      {
        source: '/s/:token*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
};

export default nextConfig;
