import { useState } from 'react';
import { createHousehold, frError, joinHousehold, resetPassword, signIn, signUp, updatePassword } from '../lib/auth';
import { defaultSettings } from '../lib/defaults';
import { L, setLang, useLang } from '../lib/i18n';

function Logo() {
  return <img className="logo-big" src="/icons/icon-192.png" alt="" width={96} height={96} />;
}

/** Choix de la langue, en bas des écrans de connexion */
function LangSwitch() {
  const lang = useLang();
  return (
    <button className="textlink" style={{ marginTop: 28 }} onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}>
      {lang === 'fr' ? '🇬🇧 English' : '🇫🇷 Français'}
    </button>
  );
}

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.includes('@')) return setError(L('Indiquez votre adresse e-mail.', 'Enter your e-mail address.'));
    if (mode !== 'forgot' && password.length < 8) return setError(L('Mot de passe : 8 caractères minimum.', 'Password: 8 characters minimum.'));
    setBusy(true);
    try {
      if (mode === 'login') await signIn(email, password);
      else if (mode === 'signup') {
        const needConfirm = await signUp(email, password);
        if (needConfirm) {
          setInfo(L("C'est presque fini ! Ouvrez l'e-mail reçu et cliquez sur le lien de confirmation, puis revenez ici pour vous connecter.", 'Almost done! Open the e-mail you received and click the confirmation link, then come back here to sign in.'));
          setMode('login');
        }
      } else {
        await resetPassword(email);
        setInfo(L("Si un compte existe avec cette adresse, un e-mail vient de partir. Cliquez sur le lien qu'il contient pour choisir un nouveau mot de passe.", 'If an account exists with this address, an e-mail is on its way. Click the link in it to choose a new password.'));
      }
    } catch (err) {
      setError(frError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth fade-in">
      <Logo />
      <h1>
        Gecko <span style={{ color: 'var(--brand-word)' }}>Budget</span>
      </h1>
      <p className="lead">
        {mode === 'signup'
          ? L('Créez votre compte. Chacun de vous deux a le sien.', 'Create your account. Each of you has your own.')
          : mode === 'forgot'
            ? L('Recevez un lien pour choisir un nouveau mot de passe.', 'Get a link to choose a new password.')
            : L('Bienvenue sur Gecko Budget 🦎', 'Welcome to Gecko Budget 🦎')}
      </p>
      {mode !== 'forgot' && (
        <div className="seg">
          <button className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
            {L('Se connecter', 'Sign in')}
          </button>
          <button className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>
            {L('Créer un compte', 'Create an account')}
          </button>
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input id="email" className="field" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={L('prenom@exemple.fr', 'name@example.com')} />
        {mode !== 'forgot' && (
          <>
            <label className="label" htmlFor="pw">
              {L('Mot de passe', 'Password')}
            </label>
            <input
              id="pw"
              className="field"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={L('8 caractères minimum', '8 characters minimum')}
            />
          </>
        )}
        {error && (
          <div className="error-msg" role="alert">
            {error}
          </div>
        )}
        {info && <div className="info-msg">{info}</div>}
        <button className="btn" style={{ marginTop: 20 }} disabled={busy}>
          {busy
            ? L('Un instant…', 'One moment…')
            : mode === 'login'
              ? L('Se connecter', 'Sign in')
              : mode === 'signup'
                ? L('Créer mon compte', 'Create my account')
                : L('Envoyer le lien', 'Send the link')}
        </button>
      </form>
      <button className="textlink" onClick={() => setMode(mode === 'forgot' ? 'login' : 'forgot')}>
        {mode === 'forgot' ? L('← Retour', '← Back') : L('Mot de passe oublié ?', 'Forgot your password?')}
      </button>
      <LangSwitch />
    </main>
  );
}

export function NewPasswordScreen({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <main className="auth fade-in">
      <Logo />
      <h1>{L('Nouveau mot de passe', 'New password')}</h1>
      <p className="lead">{L('Choisissez votre nouveau mot de passe.', 'Choose your new password.')}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (pw.length < 8) return setError(L('8 caractères minimum.', '8 characters minimum.'));
          setBusy(true);
          try {
            await updatePassword(pw);
            onDone();
          } catch (err) {
            setError(frError(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <input className="field" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={L('8 caractères minimum', '8 characters minimum')} aria-label={L('Nouveau mot de passe', 'New password')} />
        {error && <div className="error-msg">{error}</div>}
        <button className="btn" style={{ marginTop: 20 }} disabled={busy}>
          {L('Enregistrer', 'Save')}
        </button>
      </form>
    </main>
  );
}

export function HouseholdScreen({ uid, onReady, onSignOut }: { uid: string; onReady: (hid: string) => void; onSignOut: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      onReady(await fn());
    } catch (e) {
      setError(frError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth fade-in">
      <Logo />
      <h1>{L('Notre foyer', 'Our household')}</h1>
      <p className="lead">{L("Vos données sont rangées dans un « foyer » que vous partagez à deux, et que personne d'autre ne peut voir.", 'Your data lives in a “household” that the two of you share, and that nobody else can see.')}</p>
      <div className="card">
        <h3 className="t" style={{ margin: '0 0 6px', fontSize: 19 }}>
          {L('Je suis le premier', "I'm the first one")}
        </h3>
        <p className="help">{L('Créez le foyer. Vous recevrez un code à donner à votre moitié.', "Create the household. You'll get a code to give to your partner.")}</p>
        <button className="btn" disabled={busy} onClick={() => run(() => createHousehold(uid, defaultSettings()))}>
          {L('Créer notre foyer', 'Create our household')}
        </button>
      </div>
      <div className="card">
        <h3 className="t" style={{ margin: '0 0 6px', fontSize: 19 }}>
          {L("J'ai un code", 'I have a code')}
        </h3>
        <p className="help">{L('Le code est dans les réglages (⚙️) du téléphone qui a créé le foyer.', 'The code is in the settings (⚙️) of the phone that created the household.')}</p>
        <input
          className="field"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder={L('ex. K7M2QX', 'e.g. K7M2QX')}
          aria-label={L('Code du foyer', 'Household code')}
          style={{ letterSpacing: '0.2em', fontWeight: 700, textAlign: 'center', fontSize: 20 }}
          autoCapitalize="characters"
          autoComplete="off"
        />
        <button className="btn" style={{ marginTop: 12 }} disabled={busy || code.length !== 6} onClick={() => run(() => joinHousehold(uid, code))}>
          {L('Rejoindre le foyer', 'Join the household')}
        </button>
      </div>
      {error && (
        <div className="error-msg" role="alert">
          {error}
        </div>
      )}
      <button className="textlink" onClick={onSignOut}>
        {L('Se déconnecter', 'Sign out')}
      </button>
      <LangSwitch />
    </main>
  );
}
