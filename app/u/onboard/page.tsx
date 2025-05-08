'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/utils/supabase/client';
import { Loader2 } from 'lucide-react';
import { User } from '@supabase/supabase-js';

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isFetchingUser, setIsFetchingUser] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user: fetchedUser }, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error fetching user:", error);
        toast.error("Authentication Error", { description: "Could not retrieve user session. Please sign in again." });
        router.push('/u/auth?mode=signin');
      } else {
        setUser(fetchedUser);
      }
      setIsFetchingUser(false);
    };
    fetchUser();
  }, [supabase, router]);

  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      toast.success('Email Verified!', { description: 'Your email address has been successfully confirmed.' });
      router.replace('/u/onboard', { scroll: false });
    }
  }, [searchParams, router]);

  if (isFetchingUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-100 to-white dark:from-neutral-900 dark:to-neutral-800/50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className='text-2xl font-bold'>Complete Your Profile</CardTitle>
          <CardDescription>
            Just a few more details to get you started. Select your primary role.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}