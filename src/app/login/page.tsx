'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, AlertCircle, ArrowRight, Check, Briefcase, Map, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { createClient } from '@/lib/supabase/client';

const TAGLINES = [
  'Schedule jobs, dispatch crews, get paid.',
  'Your field-service command centre.',
  'Built for Irish trades. Easy to use.',
  'See every job. Every site. In one place.',
];

const FEATURES = [
  { icon: Briefcase, text: 'Track every job from quote to invoice' },
  { icon: Map,       text: 'See all jobs pinned on a live map' },
  { icon: Clock,     text: 'Built-in clock-in / clock-out for crews' },
  { icon: FileText,  text: 'Generate work orders and invoices' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [tagIdx, setTagIdx] = useState(0);
  const [capsOn, setCapsOn] = useState(false);
  const [mouse, setMouse] = useState({ x: 50, y: 50 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Rotate the tagline every 4 s
  useEffect(() => {
    const t = setInterval(() => setTagIdx(i => (i + 1) % TAGLINES.length), 4000);
    return () => clearInterval(t);
  }, []);

  // Mouse-tracking gradient
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) { setError('Please enter your email address.'); triggerShake(); return; }
    if (!emailValid) { setError('That email looks invalid.'); triggerShake(); return; }
    if (!password) { setError('Please enter your password.'); triggerShake(); return; }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message || 'Invalid email or password.');
        triggerShake();
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-charcoal relative overflow-hidden">
      {/* Mouse-tracking glow */}
      <div
        className="pointer-events-none absolute inset-0 transition-[background] duration-300"
        style={{
          background: `radial-gradient(600px circle at ${mouse.x}% ${mouse.y}%, rgba(92,143,90,0.18), transparent 40%)`,
        }}
      />

      {/* Animated grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Floating orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-vision-green/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-solar-orange/15 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* LEFT — brand panel */}
      <div className="hidden lg:flex relative z-10 flex-col justify-between flex-1 px-16 py-12 text-white">
        <div className="flex items-center gap-3">
          <Image src="/images/logo.svg" alt="VisionSolar" width={200} height={50} priority />
        </div>

        <div className="space-y-8 max-w-lg">
          <div>
            <h1 className="text-5xl font-bold leading-tight mb-4 tracking-tight">
              Run your field business.
              <br />
              <span className="bg-gradient-to-r from-solar-orange to-vision-green bg-clip-text text-transparent">
                Without the chaos.
              </span>
            </h1>
            <div className="h-7 overflow-hidden">
              <p
                key={tagIdx}
                className="text-lg text-white/70 animate-fade-in-up"
              >
                {TAGLINES[tagIdx]}
              </p>
            </div>
          </div>

          <ul className="space-y-3">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <li
                  key={i}
                  className="flex items-center gap-3 text-white/80 animate-fade-in-up"
                  style={{ animationDelay: `${300 + i * 100}ms` }}
                >
                  <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center backdrop-blur-sm">
                    <Icon className="w-4 h-4 text-vision-green" />
                  </div>
                  <span className="text-sm">{f.text}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="text-xs text-white/40">
          © {new Date().getFullYear()} VisionSolar · Ireland
        </p>
      </div>

      {/* RIGHT — login card */}
      <div className="relative z-10 flex items-center justify-center w-full lg:w-[520px] p-6">
        <div
          ref={cardRef}
          className={`relative w-full max-w-md ${shake ? 'animate-shake' : ''}`}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6 border border-white/10">

            {/* Mobile logo (lg:hidden) */}
            <div className="lg:hidden flex justify-center">
              <Image src="/images/logo.svg" alt="VisionSolar" width={200} height={50} priority />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-charcoal">Welcome back</h2>
              <p className="text-sm text-mid-gray">Sign in to your VisionSolar account</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="text-xs font-medium text-charcoal uppercase tracking-wider">
                  Email
                </label>
                <div className="relative">
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@visionsolar.ie"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 bg-off-white border-light-gray focus:border-vision-green focus:ring-vision-green/20 pr-10 transition-all"
                    autoComplete="email"
                  />
                  {email && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 transition-all">
                      {emailValid ? (
                        <Check className="w-4 h-4 text-vision-green animate-pop-in" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-solar-orange" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="login-password" className="text-xs font-medium text-charcoal uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => setCapsOn(e.getModifierState && e.getModifierState('CapsLock'))}
                    onKeyUp={(e) => setCapsOn(e.getModifierState && e.getModifierState('CapsLock'))}
                    className="h-11 bg-off-white border-light-gray focus:border-vision-green focus:ring-vision-green/20 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-mid-gray hover:text-dark-gray transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {capsOn && (
                  <p className="text-xs text-solar-orange flex items-center gap-1 animate-fade-in">
                    <AlertCircle className="w-3 h-3" /> Caps Lock is on
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(c) => setRememberMe(c === true)}
                    className="border-light-gray data-[state=checked]:bg-vision-green data-[state=checked]:border-vision-green"
                  />
                  <label htmlFor="remember-me" className="text-sm text-dark-gray cursor-pointer select-none">
                    Remember me
                  </label>
                </div>
                <button type="button" className="text-sm text-vision-green hover:text-green-dark font-medium transition-colors">
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="group w-full h-11 bg-solar-orange hover:bg-orange-light text-white font-semibold text-base shadow-lg shadow-solar-orange/25 transition-all duration-200 hover:shadow-xl hover:shadow-solar-orange/40 disabled:opacity-60 gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>

            <p className="text-center text-xs text-mid-gray pt-2">
              Need an account? Contact your administrator.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          50% { transform: translateX(8px); }
          75% { transform: translateX(-4px); }
        }
        @keyframes popIn {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulseSlow {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.05); opacity: 0.7; }
        }
        :global(.animate-fade-in-up) { animation: fadeInUp 600ms ease-out forwards; }
        :global(.animate-shake) { animation: shake 400ms ease-in-out; }
        :global(.animate-pop-in) { animation: popIn 200ms ease-out forwards; }
        :global(.animate-pulse-slow) { animation: pulseSlow 6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
