import { SignIn } from '@clerk/nextjs';
import Navbar from '@/components/Navbar';

export default function SignInPage() {
  return (
    <>
      <Navbar />
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 'calc(100vh - 80px)',
        background: 'var(--bg-dark, #0b0f19)',
        padding: '2rem'
      }}>
        <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
      </div>
    </>
  );
}
