import { redirect } from 'next/navigation';

// Anonymous questions now live in Hush.
export default function AnonymousRedirect() {
  redirect('/hush');
}
