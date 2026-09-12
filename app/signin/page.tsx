import Link from 'next/link';
import AuthCard from '@/components/auth-card';

export default function SignInPage() {
  return (
    <main className="auth-page">
      <Link href="/" className="auth-brand">
        <img src="/icon.png" alt="" />
        <span>NowMyWork</span>
      </Link>
      <AuthCard mode="signin" />
    </main>
  );
}
