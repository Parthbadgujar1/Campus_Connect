import type { Offer, Service } from '@/lib/types';
import { daysAgo, istAt } from '@/lib/time';

// ── Student-to-student services (module 18) ─────────────────────────────────

export const services: Service[] = [
  { id: 'sv-1', title: 'Website for your club or project', category: 'Website development', providerId: 'p-harsh', price: 'From ₹2,500', rating: 4.8, reviews: 23, delivery: '5–7 days', description: 'Single-page or small multi-page sites in React or plain HTML. Hosting setup included.', seed: 'sv-1' },
  { id: 'sv-2', title: 'Coding help: DSA & Java assignments', category: 'Coding help', providerId: 'p-rohan', price: '₹200 / hour', rating: 4.9, reviews: 57, delivery: 'Same day', description: 'Clear explanations, practice problems and debugging. Online or in the library.', seed: 'sv-2' },
  { id: 'sv-3', title: 'Resume & LinkedIn review', category: 'Resume creation', providerId: 'p-diya', price: '₹150', rating: 4.7, reviews: 34, delivery: '24 hours', description: 'Ruthless but kind feedback. ATS-friendly template and keyword tuning.', seed: 'sv-3' },
  { id: 'sv-4', title: 'Poster & social media design', category: 'Design', providerId: 'p-aditi', price: '₹600 / poster', rating: 4.9, reviews: 41, delivery: '2–3 days', description: 'Figma designs for events, clubs and projects. Source files included.', seed: 'sv-4' },
  { id: 'sv-5', title: 'Short-form video editing', category: 'Video editing', providerId: 'p-shruti', price: '₹400 / reel', rating: 4.6, reviews: 18, delivery: '2 days', description: 'Cuts, captions and sound design for event recaps and promo reels.', seed: 'sv-5' },
  { id: 'sv-6', title: 'Event photography (2 hours)', category: 'Event photography', providerId: 'p-kunal', price: '₹1,200', rating: 4.5, reviews: 29, delivery: 'Event day', description: 'Candid and posed shots, 80+ edited photos delivered via a shared link.', seed: 'sv-6' },
  { id: 'sv-7', title: 'Printing & spiral binding', category: 'Printing', providerId: 'b-print', price: 'From ₹2/page', rating: 4.4, reviews: 88, delivery: 'Same day', description: 'Assignments, project reports and posters. Student rates on black & white.', seed: 'sv-7' },
  { id: 'sv-8', title: 'Freelance ML model for your project', category: 'Freelancing', providerId: 'p-tanvi', price: 'Quote on request', rating: 4.7, reviews: 12, delivery: 'Varies', description: 'Data cleaning, model selection and a readable report for mini and final-year projects.', seed: 'sv-8' },
];

// ── Local offers (module 19) ────────────────────────────────────────────────

export const offers: Offer[] = [
  { id: 'of-1', business: 'Campus Brew Café', category: 'Cafe', headline: '20% off cold brew after 4 PM', discount: '20% OFF', code: 'BREW20', validTill: istAt(30, 23, 59), distanceKm: 0.2, verified: true, redeemed: 412, seed: 'of-1', terms: 'Student ID required. Not valid with other offers.' },
  { id: 'of-2', business: 'Shree Print Hub', category: 'Printing', headline: 'Free spiral binding with 50+ pages', discount: 'FREE BINDING', code: 'BIND50', validTill: istAt(20, 23, 59), distanceKm: 0.1, verified: true, redeemed: 186, seed: 'of-2', terms: 'Black & white printing only.' },
  { id: 'of-3', business: 'FitZone Gym', category: 'Gym', headline: 'First month at ₹999 for students', discount: '₹999 / MONTH', code: 'FIT999', validTill: istAt(45, 23, 59), distanceKm: 1.6, verified: true, redeemed: 93, seed: 'of-3', terms: 'Annual plan on request. Valid for new members.' },
  { id: 'of-4', business: 'StyleCraft Clothing', category: 'Clothing', headline: 'Flat 30% on kurtas and shirts', discount: '30% OFF', code: 'STYLE30', validTill: istAt(12, 23, 59), distanceKm: 2.3, verified: true, redeemed: 58, seed: 'of-4', terms: 'In-store only. Valid till stock lasts.' },
  { id: 'of-5', business: 'QuickFix Laptop Repair', category: 'Laptop repair', headline: 'Free diagnostics + 10% on parts', discount: '10% OFF PARTS', code: 'FIXIT10', validTill: istAt(60, 23, 59), distanceKm: 3.1, verified: true, redeemed: 40, seed: 'of-5', terms: 'Bring your student ID and the device.' },
  { id: 'of-6', business: 'Mobile Care Point', category: 'Mobile repair', headline: 'Screen guard fitted free', discount: 'FREE FIT', code: 'SCREEN', validTill: daysAgo(-14), distanceKm: 1.2, verified: false, redeemed: 22, seed: 'of-6', terms: 'With any screen replacement.' },
  { id: 'of-7', business: 'Stationery Corner', category: 'Stationery', headline: 'Bulk notebooks: buy 5 get 1 free', discount: 'BUY 5 GET 1', code: 'NOTES6', validTill: istAt(25, 23, 59), distanceKm: 0.4, verified: true, redeemed: 131, seed: 'of-7', terms: 'Applies to A4 ruled notebooks.' },
  { id: 'of-8', business: 'Coachify GATE Classes', category: 'Coaching', headline: 'Free mock test with any enrolment', discount: 'FREE MOCK', code: 'GATE26', validTill: istAt(50, 23, 59), distanceKm: 2.8, verified: true, redeemed: 75, seed: 'of-8', terms: 'Mock test series worth ₹1,200.' },
  { id: 'of-9', business: 'Glow Salon', category: 'Salon', headline: 'Men’s haircut ₹149 on weekdays', discount: '₹149', code: 'HAIR149', validTill: istAt(28, 23, 59), distanceKm: 1.9, verified: true, redeemed: 64, seed: 'of-9', terms: 'Weekdays 10 AM–5 PM.' },
  { id: 'of-10', business: 'Thali Express', category: 'Food', headline: 'Combo meal 15% off with student ID', discount: '15% OFF', code: 'THALI15', validTill: istAt(35, 23, 59), distanceKm: 0.9, verified: true, redeemed: 301, seed: 'of-10', terms: 'Dine-in and takeaway.' },
];

// ── Student business hub (module 20) and business dashboard (57) ───────────

export const businessProfile = {
  name: 'Campus Brew Café',
  category: 'Café',
  location: 'Library Road',
  verified: true,
  followers: 2400,
  reach30d: 18640,
  redemptions30d: 412,
  leads30d: 86,
  spend30d: 6400,
  seed: 'b-brew',
};

export const dailyReach = [
  { day: 'Mon', value: 2100 },
  { day: 'Tue', value: 2600 },
  { day: 'Wed', value: 2900 },
  { day: 'Thu', value: 2300 },
  { day: 'Fri', value: 3600 },
  { day: 'Sat', value: 3200 },
  { day: 'Sun', value: 1940 },
];

export const coupons = [
  { id: 'cp-brew', code: 'BREW20', discount: '20% off cold brew', limit: 500, redeemed: 412, validTill: istAt(30, 23, 59), status: 'Active' as const },
  { id: 'cp-combo', code: 'STUDY2X', discount: 'Buy 2 sandwiches, get chai free', limit: 200, redeemed: 124, validTill: istAt(10, 23, 59), status: 'Active' as const },
  { id: 'cp-exam', code: 'EXAMWEEK', discount: '₹50 off any meal (exam week)', limit: 300, redeemed: 300, validTill: daysAgo(3), status: 'Expired' as const },
];

export const businessLeads = [
  { id: 'ld-1', name: 'Rohan D.', interest: 'Bulk coffee order for a hackathon', at: istAt(-1, 15), status: 'New' as const },
  { id: 'ld-2', name: 'GDSC Campus Chapter', interest: 'Sponsorship for the 24-hour hackathon', at: istAt(-2, 11), status: 'Contacted' as const },
  { id: 'ld-3', name: 'Placement Cell', interest: 'Catering for the drive day', at: istAt(-4, 9), status: 'Won' as const },
];

export const adPlans = [
  { id: 'ap-student', name: 'Student Premium', price: '₹99 / month', tagline: 'Priority in feeds, extra storage, AI resume review.', forWho: 'Students', features: ['Ad-free feed', 'Priority in search', 'AI resume review', '10 GB storage'] },
  { id: 'ap-biz-basic', name: 'Business Basic', price: '₹999 / month', tagline: 'Business profile, offers and coupon codes.', forWho: 'Local businesses', features: ['Verified business profile', 'Unlimited offers', 'Coupon analytics', 'Lead inbox'] },
  { id: 'ap-biz-pro', name: 'Business Pro', price: '₹2,999 / month', tagline: 'Sponsored posts, event promotion and audience targeting.', forWho: 'Brands & sponsors', features: ['Sponsored campus posts', 'Audience targeting by college & year', 'Event promotion', 'Monthly analytics'] },
  { id: 'ap-college', name: 'College SaaS', price: 'Custom', tagline: 'Full campus platform for your institution.', forWho: 'Colleges', features: ['Admin platform', 'SSO & verification', 'Moderation tools', 'Dedicated onboarding'] },
];

export const featuredListing = { title: 'Featured listing · Hostel-ready laptop bag', price: '₹149 / week', status: 'Scheduled' as const };
