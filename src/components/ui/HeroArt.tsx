export function HeroArt({ seed = 0, src }: { seed?: number; src?: string }) {
  const g = `g${seed}`;
  return (
    <>
      <div className="hero-art" aria-hidden="true">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" />
        ) : (
          <svg viewBox="0 0 430 220" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id={`sky${g}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#2A1408" />
                <stop offset=".45" stopColor="#6E3A15" />
                <stop offset=".72" stopColor="#C87A2E" />
                <stop offset="1" stopColor="#3A2010" />
              </linearGradient>
              <radialGradient id={`sun${g}`} cx=".62" cy=".62" r=".5">
                <stop offset="0" stopColor="#FFC978" stopOpacity=".95" />
                <stop offset="1" stopColor="#FF9A3C" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="430" height="220" fill={`url(#sky${g})`} />
            <circle cx="250" cy="150" r="120" fill={`url(#sun${g})`} />
            <g fill="#180F09" opacity=".55">
              <path d="M0 150h34v-18h10v18h26v-30h14v30h30v-14h12v14h40v-46h9l5-22 5 22h9v46h56v-26h13v26h60v-34h12v34h38v-20h10v20h47v70H0z" />
            </g>
            <g fill="#0D0805">
              <path d="M0 176h46v-16h12v16h34v-24h11v24h36v-12h13v12h33v-38h8l6-26 6 26h8v38h52v-20h12v20h54v-28h11v28h32v-14h12v14h44v44H0z" />
            </g>
            <g fill="#080604" opacity=".92">
              <ellipse cx="348" cy="104" rx="26" ry="29" />
              <path d="M300 220c0-46 20-74 48-74s48 28 48 74z" />
            </g>
            <rect width="430" height="220" fill={`url(#sun${g})`} opacity=".12" />
          </svg>
        )}
      </div>
      <div className="hero-fade" aria-hidden="true" />
    </>
  );
}
