import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Shared Redis client — requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Login: 5 attempts per IP per 15 minutes
export const loginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'rl:login',
})

// Signup: 3 accounts per IP per hour
export const signupLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: 'rl:signup',
})

// Invoice/estimate sending: 50 sends per user per hour
export const sendLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, '1 h'),
  prefix: 'rl:send',
})

// Contact form: 5 submissions per IP per hour
export const contactLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'rl:contact',
})

// Admin announcement: 10 sends per day (hard cap)
export const announcementLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '24 h'),
  prefix: 'rl:announcement',
})

// Session registration: 4 requests per IP per 15 minutes
export const sessionRegisterLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(4, '15 m'),
  prefix: 'rl:session-register',
})
