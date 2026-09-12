import Link from 'next/link';
import AuthCard from '@/components/auth-card';

export default function SignUpPage() {
  return (
    <main className="auth-page">
      <Link href="/" className="auth-brand">
        <img src="/icon.png" alt="" />
        <span>NowMyWork</span>
      </Link>
      <AuthCard mode="signup" />
    </main>
  );
}
