import { useState } from 'react';
import { createHousehold, frError, joinHousehold, resetPassword, signIn, signUp, updatePassword } from '../lib/auth';
import { defaultSettings } from '../lib/defaults';

function Logo() {
  return <img className="logo-big" src="/icons/icon-192.png" alt="" width={96} height={96} />;
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
    if (!email.includes('@')) return setError('Indiquez votre adresse e-mail.');
    if (mode !== 'forgot' && password.length < 8) return setError('Mot de passe : 8 caractères minimum.');
    setBusy(true);
    try {
      if (mode === 'login') await signIn(email, password);
      else if (mode === 'signup') {
        const needConfirm = await signUp(email, password);
        if (needConfirm) {
          setInfo("C'est presque fini ! Ouvrez l'e-mail reçu et cliquez sur le lien de confirmation, puis revenez ici pour vous connecter.");
          setMode('login');
        }
      } else {
        await resetPassword(email);
        setInfo("Si un compte existe avec cette adresse, un e-mail vient de partir. Cliquez sur le lien qu'il contient pour choisir un nouveau mot de passe.");
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
        {mode === 'signup' ? 'Créez votre compte. Chacun de vous deux a le sien.' : mode === 'forgot' ? 'Recevez un lien pour choisir un nouveau mot de passe.' : 'Bienvenue sur Gecko Budget 🦎'}
      </p>
      {mode !== 'forgot' && (
        <div className="seg">
          <button className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
            Se connecter
          </button>
          <button className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>
            Créer un compte
          </button>
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input id="email" className="field" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.fr" />
        {mode !== 'forgot' && (
          <>
            <label className="label" htmlFor="pw">
              Mot de passe
            </label>
            <input
              id="pw"
              className="field"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 caractères minimum"
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
          {busy ? 'Un instant…' : mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}
        </button>
      </form>
      <button className="textlink" onClick={() => setMode(mode === 'forgot' ? 'login' : 'forgot')}>
        {mode === 'forgot' ? '← Retour' : 'Mot de passe oublié ?'}
      </button>
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
      <h1>Nouveau mot de passe</h1>
      <p className="lead">Choisissez votre nouveau mot de passe.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (pw.length < 8) return setError('8 caractères minimum.');
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
        <input className="field" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="8 caractères minimum" aria-label="Nouveau mot de passe" />
        {error && <div className="error-msg">{error}</div>}
        <button className="btn" style={{ marginTop: 20 }} disabled={busy}>
          Enregistrer
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
      <h1>Notre foyer</h1>
      <p className="lead">Vos données sont rangées dans un « foyer » que vous partagez à deux, et que personne d'autre ne peut voir.</p>
      <div className="card">
        <h3 className="t" style={{ margin: '0 0 6px', fontSize: 19 }}>
          Je suis le premier
        </h3>
        <p className="help">Créez le foyer. Vous recevrez un code à donner à votre moitié.</p>
        <button className="btn" disabled={busy} onClick={() => run(() => createHousehold(uid, defaultSettings()))}>
          Créer notre foyer
        </button>
      </div>
      <div className="card">
        <h3 className="t" style={{ margin: '0 0 6px', fontSize: 19 }}>
          J'ai un code
        </h3>
        <p className="help">Le code est dans les réglages (⚙️) du téléphone qui a créé le foyer.</p>
        <input
          className="field"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="ex. K7M2QX"
          aria-label="Code du foyer"
          style={{ letterSpacing: '0.2em', fontWeight: 700, textAlign: 'center', fontSize: 20 }}
          autoCapitalize="characters"
          autoComplete="off"
        />
        <button className="btn" style={{ marginTop: 12 }} disabled={busy || code.length !== 6} onClick={() => run(() => joinHousehold(uid, code))}>
          Rejoindre le foyer
        </button>
      </div>
      {error && (
        <div className="error-msg" role="alert">
          {error}
        </div>
      )}
      <button className="textlink" onClick={onSignOut}>
        Se déconnecter
      </button>
    </main>
  );
}
