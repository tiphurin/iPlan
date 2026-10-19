import { redirect } from 'next/navigation'

/** Old URL; settings now live on the profile tab. */
export default function SettingsPage() {
  redirect('/profile')
}
