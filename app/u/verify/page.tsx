'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const [isResending, setIsResending] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!email) {
      toast.info("Verification Needed", { description: "Please check the email address you used to sign up for a verification link." });
    }
  }, [email]);


  const handleResendEmail = async () => {
    if (!email) {
      toast.error("Resend Failed", { description: "Email address is missing. Cannot resend verification link." });
      return;
    }
    setIsResending(true);
    toast.info("Sending verification email...", { id: 'resend-email' });

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    });

    setIsResending(false);
    if (error) {
      console.error('[VerifyEmailPage] Resend email error:', error);
      toast.error("Resend Failed", {
        description: error.message || "There was an error sending the verification email. Please try again later.",
        id: 'resend-email'
      });
    } else {
      toast.success("Email Sent!", {
        description: "Verification email resent successfully. Please check your inbox (and spam folder).",
        id: 'resend-email'
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white dark:from-neutral-950 dark:to-neutral-400/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className='text-2xl font-bold'>Verify Your Email</CardTitle>
          <CardDescription>
            A verification link has been sent to{' '}
            <span className="font-semibold text-primary">{email || 'your email address'}</span>.
            Please click the link in the email to confirm your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Didn&apos;t receive the email? Check your spam folder, or you can request a new one.
          </p>
          <Button
            onClick={handleResendEmail}
            disabled={isResending || !email}
            className="w-full max-w-xs"
          >
            {isResending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resending...
              </>
            ) : (
              'Resend Verification Email'
            )}
          </Button>
        </CardContent>
        <CardContent className="text-center text-sm text-muted-foreground border-t pt-4">
          <p>
            Already verified?{' '}
            <Link href="/u/auth?mode=signin" className="font-medium text-primary hover:underline">
              Sign In
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}