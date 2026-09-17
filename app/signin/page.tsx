import Link from 'next/link';
import AuthCard from '@/components/auth-card';

const brandIcon = '/icon.png';

export default function SignInPage() {
  return (
    <main className="auth-page">
      <Link href="/" className="auth-brand">
        <img src={brandIcon} alt="" />
        <span>NowMyWork</span>
      </Link>
      <AuthCard mode="signin" />
    </main>
  );
}
