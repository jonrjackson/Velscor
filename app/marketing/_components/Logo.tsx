export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#16233f" />
      <rect x="6" y="8.5" width="12" height="8.5" rx="1.2" stroke="#c7d4ea" strokeWidth="1.3" fill="none" />
      <path
        d="M6.4 9L12 13.2L17.6 9"
        stroke="#c7d4ea"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="16.5" cy="16.5" r="4.3" fill="#22c55e" stroke="#16233f" strokeWidth="1.2" />
      <path
        d="M14.6 16.6L15.9 17.9L18.4 15.2"
        stroke="white"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
