'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LockIcon, MailCheckIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { IoInformationOutline } from 'react-icons/io5';

import { ModeToggle } from '@/components/mode-toggle';
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
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/mobile-tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SignInInput, SignUpInput, signInSchema, signUpSchema } from '@/lib/zod.auth';
import { calculatePasswordStrength } from '@/utils/password-strength';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import LinesLoader from '@/components/linesLoader';

function AuthMessagesHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const signupSuccess = searchParams.get('signup');
  const verifyEmailNeeded = searchParams.get('verifyEmail');
  const emailForVerification = searchParams.get('email');
  const confirmationMessage = searchParams.get('message');

  useEffect(() => {
    let handled = false;

    if (errorParam && !handled) {
      if (errorParam.includes("Invalid confirmation link") || errorParam.includes("expired confirmation link") || errorParam.includes("Confirmation link expired")) {
        toast.error("Confirmation Failed", { description: errorParam });
      } else {
        toast.error("Error", { description: errorParam });
      }
      handled = true;
    }
    else if (confirmationMessage && !handled) {
      toast.success("Success", { description: confirmationMessage });
      handled = true;
    }
    else if (signupSuccess === 'success' && verifyEmailNeeded === 'true' && !handled) {
      toast.info('Email Verification Required', {
        description: `Account created! Please check ${emailForVerification ? `your email at ${emailForVerification}` : 'your email'} to confirm your address before logging in.`,
        duration: 8000,
      });
      handled = true;
    }

    if (handled) {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('error');
      newParams.delete('signup');
      newParams.delete('verifyEmail');
      newParams.delete('email');
      newParams.delete('message');
      router.replace(`${window.location.pathname}?${newParams.toString()}`, { scroll: false });
    }

  }, [searchParams]);

  return null;
}

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('next') || '/dashboard';
  const initialMode = searchParams.get('mode') || 'signin';
  const [activeTab, setActiveTab] = useState<string>(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Sign In Form
  const signInForm = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  // Sign Up Form
  const signUpForm = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: '',
      username: '',
      password: '',
    },
    mode: "onChange",
  });

  const password = signUpForm.watch('password');
  const strength = calculatePasswordStrength(password);

  const strengthColors = [
    'bg-gray-300',
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-green-500',
    'bg-emerald-600'
  ];

  useEffect(() => {
    // Update URL when tab changes without full page reload
    if (activeTab) {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set('mode', activeTab);
      router.replace(`${window.location.pathname}?${newParams.toString()}`, { scroll: false });
    }
  }, [activeTab, router, searchParams]);

  const handleSignIn = async (data: SignInInput) => {
    setIsLoading(true);
    signInForm.clearErrors('root.apiError');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        toast.success('Sign in successful!');
        router.push(callbackUrl);
      } else {
        console.error("Sign In Error Response:", result);
        const errorMessage = result.error || 'An unknown error occurred.';

        if (result.error_code === 'EMAIL_NOT_CONFIRMED') {
          toast.warning("Email Not Confirmed", {
            description: "Please check your email inbox to confirm your address before logging in.",
          });
          router.push(`/u/verify?email=${encodeURIComponent(result.email)}`);
        } else if (result.error_code === 'INVALID_CREDENTIALS') {
          signInForm.setError("root.apiError", { message: "Invalid email/username or password." });
          toast.error('Sign In Failed', { description: "Invalid email/username or password." });
        } else if (response.status === 429) {
          toast.error('Rate Limited', { description: errorMessage });
        }
        else {
          signInForm.setError("root.apiError", { message: errorMessage });
          toast.error('Sign In Failed', { description: errorMessage });
        }
      }
    } catch (error) {
      console.error("Sign In Client Catch Error:", error);
      toast.error('Sign In Failed', {
        description: 'Could not connect to the server. Please try again.',
      });
      signInForm.setError("root.apiError", { message: "Failed to connect to the server." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (data: SignUpInput) => {
    setIsLoading(true);
    signUpForm.clearErrors('root.apiError');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        // let errorMessage = `Sign-up failed with status ${response.status}.`
        const errorMessage = `Sign-up failed with status ${response.status}.`
        let parsedError;

        try {
          parsedError = await response.json();
        } catch {
          parsedError = { message: errorMessage };
        }

        switch (response.status) {
          case 400:
            signUpForm.setError("root.apiError", {
              type: "manual",
              message: parsedError.message || "Invalid input data. Please correct the fields below.",
            });
            break;
          case 409:
            signUpForm.setError("root.apiError", {
              type: "manual",
              message: parsedError.message || "Email or username already exists.",
            });
            break;
          case 429:
            toast.error("Rate Limit", { description: "Too many signup attempts. Please try again later." });
            break;
          case 500:
            toast.error("Sign Up Error", { description: "An unexpected server error occurred. Please try again." });
            break;
          default:
            toast.error("Sign Up Error", { description: errorMessage });
            break;
        }
        console.error('[SignUpPage] API Error:', parsedError);
      } else {
        const successData = await response.json();
        signUpForm.reset();
        toast.success(successData.message);
        router.push('/u/auth?mode=signin&signup=success&verifyEmail=true&email=' + encodeURIComponent(data.email));
      }
    } catch (error) {
      console.error('[SignUpPage] Network error:', error);
      signUpForm.setError("root.apiError", {
        type: "manual",
        message: "Failed to connect to the server. Please check your network."
      });
      toast.error("Sign Up Error", { description: "Failed to connect to the server. Please check your network connection." });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  return (
    <Suspense fallback={<LinesLoader />}>
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white dark:from-neutral-950 dark:to-neutral-400/10 p-4">
        <Card className="w-full max-w-md pb-0 overflow-clip">
          <CardHeader className="flex-row flex gap-4 items-center justify-between">
            <section className="grid auto-rows-min grid-rows-[auto_auto] items-start gap-1">
              <CardTitle className='text-2xl font-bold'>
                {activeTab === 'signin' ? 'Sign In' : 'Create an Account'}
              </CardTitle>
              <CardDescription>
                {activeTab === 'signin'
                  ? 'Welcome back! Access your account.'
                  : 'Enter your details to get started.'}
              </CardDescription>
            </section>
            <Image src="/logo.svg" alt="Logo" width={24} height={24} className='dark:invert-80 aspect-square' />
          </CardHeader>

          <AuthMessagesHandler />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-2/3 mx-auto grid-cols-2 mb-4">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            {/* Sign In Form */}
            <TabsContent value="signin">
              <Form {...signInForm}>
                <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-6">
                  <CardContent className="space-y-4">
                    {signInForm.formState.errors.root?.apiError && (
                      <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-md">
                        {signInForm.formState.errors.root.apiError.message}
                      </div>
                    )}

                    <FormField
                      control={signInForm.control}
                      name="identifier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email or Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Username or email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signInForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='flex-center-2 justify-between'>
                            <span>Password</span>
                            <Link href="/u/forgot" prefetch={false} className='text-muted-foreground text-xs hover:underline'>Forgot?</Link>
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
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <section className="flex flex-col gap-4">
                      <Button type="submit" disabled={isLoading} className="w-full">
                        {isLoading ? 'Signing In...' : 'Sign In'}
                      </Button>
                    </section>
                  </CardContent>
                </form>
              </Form>
            </TabsContent>

            {/* Sign Up Form */}
            <TabsContent value="signup">
              <Form {...signUpForm}>
                <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-6">
                  <CardContent className="space-y-4">
                    {signUpForm.formState.errors.root?.apiError && (
                      <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-md">
                        {signUpForm.formState.errors.root?.apiError.message}
                      </div>
                    )}

                    <FormField
                      control={signUpForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <header className='px-1 flex items-center gap-2 font-medium'>
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size={'fit-icon'} variant='outline' type='button' className='rounded-sm'>
                                    <IoInformationOutline className='hover:text-black dark:hover:text-white text-muted-foreground' />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className=''>
                                  <div className='space-y-1 flex flex-col w-60'>
                                    <h4 className='font-semibold text-base'>Email</h4>
                                    <p className='text-[.75rem] font-normal'>
                                      You are free to use any active email. You will not be able to change this later.
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                              <span className=''>Email</span>
                            </>
                          </header>
                          <FormControl>
                            <Input placeholder="Email" {...field} tabIndex={1} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signUpForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <header className='px-1 flex items-center gap-2 font-medium'>
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size={'fit-icon'} variant='outline' type='button' className='rounded-sm'>
                                      <IoInformationOutline className='hover:text-black dark:hover:text-white text-muted-foreground' />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className=''>
                                    <div className='space-y-1 flex flex-col w-60'>
                                      <h4 className='font-semibold text-base'>Username</h4>
                                      <p className='text-[.75rem] font-normal'>
                                        The username can only comprise of alphanumeric characters, dots and underscores. You will not be able to change this later.
                                      </p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                                <span className=''>Username</span>
                              </>
                            </header>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Username" {...field} tabIndex={1} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signUpForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='flex-center-2 justify-between'>
                            <span>Password</span>
                            <span className='text-muted-foreground text-xs'>Min. 8 characters</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                {...field}
                                tabIndex={1}
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
                    <section className='flex flex-col space-y-2.5 mx-1'>
                      <div className="flex-center-2">
                        <Checkbox
                          id="terms"
                        />
                        <Label htmlFor='terms' className=''>
                          I agree to the <Link prefetch={false} href="#" className='underline'>Terms of Service</Link>
                        </Label>
                      </div>
                      <div className="flex-center-2">
                        <Checkbox
                          id="privacy"
                        />
                        <Label htmlFor='privacy' className=''>
                          I agree to the <Link prefetch={false} href="#" className='underline'>Privacy Policy</Link>
                        </Label>
                      </div>
                    </section>
                    <Button type="submit" disabled={isLoading} className="w-full mt-4">
                      {isLoading ? 'Creating Account...' : 'Create Account'}
                    </Button>
                  </CardContent>
                </form>
              </Form>
            </TabsContent>

          </Tabs>

          <CardFooter className="flex flex-col items-center gap-1 bg-muted border-t-2 py-3">
            <p className="text-center text-sm text-muted-foreground">
              {activeTab === 'signin' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button onClick={() => setActiveTab('signup')} className="font-medium text-primary hover:underline">
                    Sign Up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button onClick={() => setActiveTab('signin')} className="font-medium text-primary hover:underline">
                    Sign In
                  </button>
                </>
              )}
            </p>
            <p className="text-center text-sm text-muted-foreground flex-center-2">
              <MailCheckIcon className="h-4 w-4" />
              <span>Need help?</span>{' '}
              <Link href="/contact" className="font-medium text-primary hover:underline">
                Contact Us
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </Suspense>
  );
} 