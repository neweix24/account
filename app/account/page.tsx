import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut, changeUsername, createBusinessProfile, setDefaultProfile, updateAccountProfile } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

type AccountProfileRow = {
  id: string;
  profile_type: "personal" | "business";
  display_name: string;
  is_default: boolean;
  profile_status: string;
  created_at: string;
  account_business_profiles:
    | { business_name: string; business_category: string | null; public_email: string | null; public_phone: string | null; verification_status: string }
    | { business_name: string; business_category: string | null; verification_status: string }[]
    | null;
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ username_error?: string; username_message?: string; profile_error?: string; profile_message?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel === "aal1" && assurance?.nextLevel === "aal2") redirect("/mfa");

  const { data: profile } = await supabase.from("account").select("public_id,username,full_name,display_name,email,phone,account_status,created_at,preferred_language").eq("user_id", user.id).maybeSingle();
  if (profile?.account_status !== "active") redirect("/login?error=This%20account%20is%20not%20currently%20active.");
  const { data: profiles } = await supabase.from("account_profiles")
    .select("id,profile_type,display_name,is_default,profile_status,created_at,account_business_profiles(business_name,business_category,public_email,public_phone,verification_status)")
    .eq("account_user_id", user.id).eq("profile_status", "active").order("created_at", { ascending: true });

  const displayName = profile?.display_name ?? profile?.full_name;
  const usernameErrors: Record<string, string> = {
    session_required: "Your session is no longer active. Sign in again.",
    invalid_username: "Username must be 3–20 lowercase letters, numbers, or underscores.",
    account_unavailable: "This Account is not available for username changes.",
    same_username: "This is already your username.",
    cooldown: "You can change your username once every 30 days.",
    username_taken: "That username is already in use.",
    username_reserved: "That username is reserved and cannot be used yet.",
    reservation_conflict: "That username is temporarily unavailable.",
    temporarily_unavailable: "Username change is temporarily unavailable. Try again later.",
  };
  const profileErrors: Record<string, string> = {
    invalid_business: "Enter a business name (2–120 characters) and a category under 80 characters.",
    invalid_profile: "The selected profile is invalid.",
    profile_unavailable: "The profile action could not be completed. Refresh and try again.",
  };

  return <main className="auth-shell">
    <header className="account-head"><span className="brand">Neweix Account</span><form action={signOut}><button className="button secondary" type="submit">Sign out</button></form></header>
    <section className="panel wide">
      <p className="eyebrow">YOUR IDENTITY</p><h1>Welcome{displayName ? ", " + displayName : ""}</h1><p className="muted">One central Account for your Neweix services and profiles.</p>
      <dl className="profile">
        <div><dt>Account ID</dt><dd>{profile?.public_id ?? "—"}</dd></div>
        <div><dt>Username</dt><dd>{profile?.username ?? "—"}</dd></div>
        <div><dt>Email</dt><dd>{profile?.email ?? user.email ?? "—"}</dd></div>
        <div><dt>Mobile</dt><dd>{profile?.phone ?? "Not added"}</dd></div>
        <div><dt>Language</dt><dd>{profile?.preferred_language === "bn" ? "বাংলা" : "English"}</dd></div>
        <div><dt>Account status</dt><dd>{profile?.account_status ?? "Pending"}</dd></div>
        <div><dt>Account created</dt><dd>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US") : "—"}</dd></div>
      </dl>

      <section className="panel profile-management">
        <p className="eyebrow">PROFILE MANAGEMENT</p><h2>Your profiles</h2>
        <p className="muted">Personal and Business Profiles belong to this Account. They do not create separate Accounts or Eixon Wallets.</p>
        {params.profile_error && <p className="notice error" role="alert">{profileErrors[params.profile_error] ?? profileErrors.profile_unavailable}</p>}
        {params.profile_message === "business_created" && <p className="notice success" role="status">Business Profile created.</p>}
        {params.profile_message === "profile_switched" && <p className="notice success" role="status">Default profile updated.</p>}
        {params.profile_message === "profile_updated" && <p className="notice success" role="status">Profile details updated.</p>}
        <div className="profile-grid">
          {(profiles ?? []).map((item: AccountProfileRow) => {
            const business = Array.isArray(item.account_business_profiles) ? item.account_business_profiles[0] : item.account_business_profiles;
            return <article className="profile-card" key={item.id}>
              <div className="profile-card-top"><span className="profile-type">{item.profile_type === "personal" ? "Personal Profile" : "Business Profile"}</span>{item.is_default && <span className="profile-default">Default</span>}</div>
              <h3>{item.display_name}</h3>
              {business && <p className="muted">{business.business_category || "Business"} · {business.verification_status}</p>}
              <form action={updateAccountProfile} className="profile-edit-form">
                <input type="hidden" name="profileId" value={item.id}/>
                <label>{item.profile_type === "personal" ? "Display name" : "Profile display name"}<input name="displayName" defaultValue={item.display_name} minLength={1} maxLength={100} required/></label>
                {business && <>
                  <label>Business name<input name="businessName" defaultValue={business.business_name} minLength={2} maxLength={120} required/></label>
                  <label>Business category<input name="businessCategory" defaultValue={business.business_category ?? ""} maxLength={80}/></label>
                  <label>Public email<input name="publicEmail" type="email" defaultValue={business.public_email ?? ""} maxLength={254}/></label>
                  <label>Public phone<input name="publicPhone" type="tel" defaultValue={business.public_phone ?? ""} maxLength={25}/></label>
                </>}
                <button className="button secondary" type="submit">Save profile</button>
              </form>
              {!item.is_default && <form action={setDefaultProfile}><input type="hidden" name="profileId" value={item.id}/><button className="button secondary" type="submit">Set as default</button></form>}
            </article>;
          })}
        </div>
        <form action={createBusinessProfile} className="business-profile-form">
          <h3>Create a Business Profile</h3>
          <label>Business name<input name="businessName" minLength={2} maxLength={120} required placeholder="Your business name"/></label>
          <label>Business category <span className="muted">(optional)</span><input name="businessCategory" maxLength={80} placeholder="e.g. Handicrafts"/></label>
          <button className="button primary" type="submit">Create Business Profile</button>
        </form>
      </section>

      {params.username_error && <p className="notice error" role="alert">{usernameErrors[params.username_error] ?? usernameErrors.temporarily_unavailable}</p>}
      {params.username_message === "updated" && <p className="notice success" role="status">Username updated. Your previous username is reserved for 90 days.</p>}
      <section className="panel"><h2>Change username</h2><p className="muted">You can change your username once every 30 days. Your previous username will be reserved for 90 days.</p><form action={changeUsername}><label>New username<input name="username" type="text" minLength={3} maxLength={20} pattern="[a-z0-9_]{3,20}" autoCapitalize="none" autoCorrect="off" autoComplete="off" required /></label><button className="button primary" type="submit">Update username</button></form></section>
      <p><Link href="/account/phone">Phone verification · Verify mobile number</Link></p>
      <p><Link href="/account/security">Password &amp; security · Change password</Link></p>
      <p><Link href="/mfa">Authenticator settings</Link></p>
      <p><Link href="/account/sessions">Sessions &amp; devices · Manage signed-in devices</Link></p>
      <p className="fine">Service access and permissions are managed separately by each Neweix service.</p>
    </section>
  </main>;
}
