'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Eye, EyeOff, KeyRound, MailIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Input } from '@/components/ui/input';
import { ForgotPasswordInput, OtpInput, ResetPasswordInput, forgotPasswordSchema, otpSchema, resetPasswordSchema } from '@/lib/zod.auth';
import { createClient } from '@/utils/supabase/client';
import Image from 'next/image';
import { calculatePasswordStrength } from '@/utils/password-strength';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModeToggle } from '@/components/mode-toggle';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sentToEmail, setSentToEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [isSessionValid, setIsSessionValid] = useState<boolean | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<'link' | 'otp'>('link');
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      // If we have a valid session and it's for recovery, we're in reset mode
      if (session?.user?.email && !error) {
        setIsResetMode(true);
        setIsSessionValid(true);
      } else if (searchParams.has('type') && searchParams.get('type') === 'recovery') {
        // We have recovery in the URL but no valid session
        setIsResetMode(true);
        setIsSessionValid(false);
        console.error("[ForgotPasswordPage] Invalid recovery session:", error);
        toast.error("Invalid Recovery Link", {
          description: "Your password reset link is invalid or expired. Please request a new one."
        });
      } else {
        // Regular forgot password request mode
        setIsResetMode(false);
        setIsSessionValid(null);
      }
    };

    checkSession();
  }, [searchParams, supabase.auth]);

  // Form for requesting password reset
  const requestForm = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  // Form for OTP verification
  const otpForm = useForm<OtpInput>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: '',
      email: '',
    },
  });

  // Set email field in OTP form when sent email is available
  useEffect(() => {
    if (sentToEmail) {
      otpForm.setValue('email', sentToEmail);
    }
  }, [sentToEmail, otpForm]);

  // Form for setting new password
  const resetForm = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    mode: "onChange",
  });

  const password = resetForm.watch('password');
  const strength = calculatePasswordStrength(password);

  const strengthColors = [
    'bg-gray-300',
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-green-500',
    'bg-emerald-600'
  ];

  const onSubmitRequest = async (data: ForgotPasswordInput) => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/u/forgot`, // Redirect to this same page
      });

      if (error) {
        console.error('[ForgotPasswordPage] Error:', error);
        toast.error('Request Failed', {
          description: error.message || 'Failed to send password reset email. Please try again.'
        });
      } else {
        setEmailSent(true);
        setSentToEmail(data.email);
        toast.success('Email Sent', {
          description: 'Check your inbox for password reset instructions.',
        });
      }
    } catch (error) {
      console.error('[ForgotPasswordPage] Unexpected error:', error);
      toast.error('Request Failed', {
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitOtp = async (data: OtpInput) => {
    setIsLoading(true);

    try {
      const { data: verifyData, error } = await supabase.auth.verifyOtp({
        email: data.email,
        token: data.otp,
        type: 'recovery',
      });

      if (error) {
        console.error('[ForgotPasswordPage] OTP verification error:', error);
        toast.error('Verification Failed', {
          description: error.message || 'Failed to verify OTP code. Please check the code and try again.'
        });
        otpForm.setError('otp', {
          type: 'manual',
          message: 'Invalid OTP code. Please check and try again.',
        });
      } else {
        setIsResetMode(true);
        setIsSessionValid(true);
        toast.success('OTP Verified', {
          description: 'You can now set a new password.',
        });
      }
    } catch (error) {
      console.error('[ForgotPasswordPage] Unexpected OTP error:', error);
      toast.error('Verification Failed', {
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitReset = async (data: ResetPasswordInput) => {
    if (!isSessionValid) {
      toast.error("Invalid Session", {
        description: "Your password reset link is invalid or expired. Please request a new one."
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password
      });

      if (error) {
        console.error('[ForgotPasswordPage] Error:', error);
        toast.error('Password Reset Failed', {
          description: error.message || 'Failed to reset password. Please try again.'
        });
        resetForm.setError("root", {
          message: error.message || 'Failed to reset password. Please try again.'
        });
      } else {
        toast.success('Password Updated', {
          description: 'Your password has been reset successfully. You can now sign in with your new password.',
        });

        setTimeout(() => {
          router.push('/u/auth?mode=signin&message=Your+password+has+been+reset+successfully');
        }, 2000);
      }
    } catch (error) {
      console.error('[ForgotPasswordPage] Unexpected error:', error);
      toast.error('Password Reset Failed', {
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);

  // Show invalid session error for reset mode
  if (isResetMode && isSessionValid === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white dark:from-neutral-950 dark:to-neutral-400/10 p-4">
        <Card className="w-full max-w-md pb-0 overflow-clip">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Invalid Reset Link</CardTitle>
            <CardDescription>
              Your password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please request a new password reset link to continue.
            </p>
            <Button
              onClick={() => router.push('/u/forgot')}
              className="w-full"
            >
              Request New Reset Link
            </Button>
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-1 bg-muted border-t-2 py-3">
            <Link
              href="/u/auth?mode=signin"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Waiting to check session validity
  if (isResetMode && isSessionValid === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Verifying your reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white dark:from-neutral-950 dark:to-neutral-400/10 p-4">
      <Card className="w-full max-w-md pb-0 overflow-clip">
        <CardHeader className="flex-row flex gap-4 items-center justify-between">
          <section className="grid auto-rows-min grid-rows-[auto_auto] items-start gap-1">
            <CardTitle className='text-2xl font-bold'>
              {isResetMode ? 'Create New Password' : 'Reset Password'}
            </CardTitle>
            <CardDescription>
              {isResetMode
                ? 'Enter a new password for your account'
                : emailSent
                  ? `We've sent instructions to your mail`
                  : 'Enter your email to receive a password reset link'}
            </CardDescription>
          </section>
          <Image src="/logo.svg" alt="Logo" width={24} height={24} className='dark:invert-80 aspect-square' />
        </CardHeader>

        {/* Password Request Mode (Initial State) */}
        {!isResetMode && (
          emailSent ? (
            <CardContent className="space-y-6">
              <div className="rounded-full bg-primary/10 p-6 mx-auto w-fit">
                <MailIcon className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2 text-center">
                <h3 className="text-lg font-medium">Check your email</h3>
                <p className="text-sm text-muted-foreground">
                  We&apos;ve sent a password reset link to <span className="font-medium">{sentToEmail}</span>.
                  Please check your inbox and spam folder.
                </p>
              </div>

              <Tabs defaultValue="link" className="w-full" onValueChange={(value) => setVerificationMethod(value as 'link' | 'otp')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="link">Reset Link</TabsTrigger>
                  <TabsTrigger value="otp">Reset Code</TabsTrigger>
                </TabsList>
                <TabsContent value="link" className="mt-4 space-y-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Click the password reset link in your email to continue.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setEmailSent(false);
                      requestForm.reset();
                      otpForm.reset();
                    }}
                  >
                    Send to a different email
                  </Button>
                </TabsContent>
                <TabsContent value="otp" className="mt-4 space-y-4">
                  <div className="space-y-2 text-center">
                    <div className="inline-flex items-center justify-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold">
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>Enter the 6-digit code from email</span>
                    </div>
                  </div>

                  <Form {...otpForm}>
                    <form onSubmit={otpForm.handleSubmit(onSubmitOtp)} className="space-y-4">
                      <FormField
                        control={otpForm.control}
                        name="otp"
                        render={({ field }) => (
                          <FormItem className="w-full flex justify-center">
                            <FormControl>
                              <InputOTP maxLength={6} {...field}>
                                <InputOTPGroup>
                                  <InputOTPSlot index={0} />
                                  <InputOTPSlot index={1} />
                                  <InputOTPSlot index={2} />
                                  <InputOTPSlot index={3} />
                                  <InputOTPSlot index={4} />
                                  <InputOTPSlot index={5} />
                                </InputOTPGroup>
                              </InputOTP>
                            </FormControl>
                            <FormMessage className="text-center" />
                          </FormItem>
                        )}
                      />
                      <div className="flex flex-col gap-2">
                        <Button type="submit" disabled={isLoading} className="w-full">
                          {isLoading ? 'Verifying...' : 'Verify Code'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setEmailSent(false);
                            requestForm.reset();
                            otpForm.reset();
                          }}
                        >
                          Use a different email
                        </Button>
                      </div>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          ) : (
            <Form {...requestForm}>
              <form onSubmit={requestForm.handleSubmit(onSubmitRequest)} className="space-y-6">
                <CardContent className="space-y-4">
                  <FormField
                    control={requestForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="your.email@example.com" {...field} autoComplete="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </CardContent>
              </form>
            </Form>
          )
        )}

        {/* Password Reset Mode (After clicking email link or verifying OTP) */}
        {isResetMode && isSessionValid && (
          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(onSubmitReset)} className="space-y-6">
              <CardContent className="space-y-4">
                {resetForm.formState.errors.root?.message && (
                  <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-md">
                    {resetForm.formState.errors.root.message}
                  </div>
                )}

                <FormField
                  control={resetForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='flex-center-2 justify-between'>
                        <span>New Password</span>
                        <span className='text-muted-foreground text-xs'>Min. 8 characters</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                            onClick={togglePasswordVisibility}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
                          </Button>
                        </div>
                      </FormControl>
                      <div className="my-1 flex w-full gap-1 h-2">
                        {[0, 1, 2, 3].map((level) => (
                          <div
                            key={level}
                            className={`h-full flex-1 rounded-full transition-colors duration-300 ${level < strength - 1 ? strengthColors[strength] : 'bg-gray-300'}`}
                          ></div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={resetForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                            onClick={toggleConfirmPasswordVisibility}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            <span className="sr-only">{showConfirmPassword ? 'Hide password' : 'Show password'}</span>
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? 'Updating Password...' : 'Reset Password'}
                </Button>
              </CardContent>
            </form>
          </Form>
        )}

        <CardFooter className="flex flex-col items-center gap-1 bg-muted border-t-2 py-3">
          <Link
            href="/u/auth?mode=signin"
            className="flex items-center text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to sign in
          </Link>
        </CardFooter>
      </Card>

    </div>
  );
}
