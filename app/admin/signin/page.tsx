import Link from 'next/link';
import AdminAuthCard from '@/components/admin-auth-card';

const brandIcon = 'https://raw.githubusercontent.com/Manav9910ms/nowmywork/main/icon.png';

export default function AdminSignInPage() {
  return (
    <main className="auth-page">
      <Link href="/" className="auth-brand">
        <img src={brandIcon} alt="" />
        <span>NowMyWork</span>
      </Link>
      <AdminAuthCard />
    </main>
  );
}
