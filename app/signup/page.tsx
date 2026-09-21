import Link from 'next/link';
import AuthCard from '@/components/auth-card';

const brandIcon = '/icon.svg';

export default function SignUpPage() {
  return (
    <main className="auth-page">
      <Link href="/" className="auth-brand">
        <img src={brandIcon} alt="" />
        <span>NowMyWork</span>
      </Link>
      <AuthCard mode="signup" />
    </main>
  );
}
