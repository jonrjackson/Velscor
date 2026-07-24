export default function Logo({ size = 28 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/assets/icon-64.png" alt="" width={size} height={size} style={{ borderRadius: "50%" }} />;
}
