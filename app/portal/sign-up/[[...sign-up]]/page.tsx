import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "80px 24px" }}>
      <SignUp />
    </div>
  );
}
