import crypto from 'crypto';
import express from 'express';
import { db } from './db.js';

// Secret to sign the 24-hour gate pass
const GATE_SECRET = process.env.GATE_SECRET || 'scam_gate_cookie_sig_v4_' + (process.env.RESET_KEY || '2026_cookie_key_991828');
const GATE_COOKIE_NAME = 'scam_gate_pass';
const AUTH_COOKIE_NAME = 'scam_auth_token';
const GATE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function generateGateToken(): string {
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac('sha256', GATE_SECRET)
    .update(timestamp)
    .digest('hex');
  return `${timestamp}.${signature}`;
}

export function verifyGateToken(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  // Check TTL (24 hours)
  const now = Date.now();
  if (now - timestamp > GATE_TTL_MS || timestamp > now + 300000) {
    return false;
  }

  // Verify HMAC signature
  const expectedSig = crypto
    .createHmac('sha256', GATE_SECRET)
    .update(timestampStr)
    .digest('hex');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length) return false;

  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export function isRequestAuthorized(req: express.Request): {
  isAuthorized: boolean;
  isUser: boolean;
  user?: any;
  gatePass?: string;
} {
  // 1. Check Authorization header or Auth Cookie or Auth query
  const authHeader = req.headers.authorization;
  let authToken: string | undefined = undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    authToken = authHeader.replace('Bearer ', '').trim();
  } else if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
    authToken = req.cookies[AUTH_COOKIE_NAME];
  } else if (req.query && typeof req.query.auth_token === 'string') {
    authToken = req.query.auth_token;
  }

  if (authToken) {
    const user = db.getUserById(authToken) || db.getUserByUsername(authToken);
    if (user && !user.isBanned) {
      return { isAuthorized: true, isUser: true, user };
    }
  }

  // 2. Check 24-hour Gate Pass Cookie, Header, or Query Param
  const queryGate = typeof req.query.gate_pass === 'string' ? req.query.gate_pass : undefined;
  const headerGate = (req.headers['x-gate-pass'] as string) || undefined;
  const gateCookie = req.cookies ? req.cookies[GATE_COOKIE_NAME] : undefined;

  const tokenToCheck = queryGate || headerGate || gateCookie;
  if (verifyGateToken(tokenToCheck)) {
    return { isAuthorized: true, isUser: false, gatePass: tokenToCheck };
  }

  return { isAuthorized: false, isUser: false };
}

export function setGateCookies(res: express.Response, authToken?: string): string {
  const gateToken = generateGateToken();

  // Set 24h Gate Cookie with SameSite=None and Secure for iframe / cross-origin preview support
  res.cookie(GATE_COOKIE_NAME, gateToken, {
    maxAge: GATE_TTL_MS,
    httpOnly: false,
    sameSite: 'none',
    secure: true,
    path: '/',
  });

  if (authToken) {
    res.cookie(AUTH_COOKIE_NAME, authToken, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: false,
      sameSite: 'none',
      secure: true,
      path: '/',
    });
  }

  return gateToken;
}

export function clearAuthCookie(res: express.Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
  res.clearCookie(GATE_COOKIE_NAME, { path: '/' });
}

export function renderCoffeeShopGateHtml(sitekey: string): string {
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kavárna U Zlatého Plamene | Výběrová káva &amp; Domácí pekárna Praha Malá Strana</title>
  <meta name="description" content="Tradiční pražská kavárna v srdci Malé Strany. Čerstvě pražená 100% výběrová Arabica, domácí máslové koláče, snídaně a klidné historické posezení s výhledem na Petřín.">
  <meta name="keywords" content="kavárna Praha, výběrová káva, Malá Strana káva, espresso bar Praha, snídaně Praha 1, domácí pekárna, kavárna U Zlatého Plamene">
  <meta name="author" content="Kavárna U Zlatého Plamene s.r.o.">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta name="robots" content="index, follow">

  <style>
    /* CSS for the Underlying Authentic Prague Coffee Shop Landing */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #2b2520;
      background-color: #fcf9f2;
      line-height: 1.6;
      position: relative;
      min-height: 100vh;
      overflow: hidden;
    }

    /* Coffee Shop Structure */
    .cafe-header {
      background: #3c2a21;
      color: #fdfaf6;
      padding: 1.5rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .cafe-logo {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .cafe-nav a {
      color: #e5d4c0;
      text-decoration: none;
      margin-left: 1.5rem;
      font-weight: 500;
    }
    .cafe-hero {
      padding: 4rem 2rem;
      text-align: center;
      background: linear-gradient(rgba(60, 42, 33, 0.05), rgba(60, 42, 33, 0.08));
    }
    .cafe-hero h1 {
      font-size: 2.5rem;
      color: #3c2a21;
      margin-bottom: 1rem;
    }
    .cafe-hero p {
      font-size: 1.2rem;
      color: #634832;
      max-width: 680px;
      margin: 0 auto 2rem;
    }
    .menu-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 2rem;
      max-width: 1000px;
      margin: 3rem auto;
      padding: 0 1rem;
    }
    .menu-card {
      background: #ffffff;
      border: 1px solid #eadecc;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.03);
    }
    .menu-card h3 {
      color: #3c2a21;
      margin-bottom: 0.5rem;
      display: flex;
      justify-content: space-between;
    }
    .menu-card span.price {
      color: #d97706;
      font-weight: 700;
    }
    .cafe-footer {
      background: #1f1610;
      color: #a89f91;
      padding: 3rem 2rem;
      text-align: center;
      font-size: 0.9rem;
    }

    /* ==========================================================
       DISGUISED CAPTCHA OVERLAY
       ========================================================== */
    #cookie-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 999999;
      background: radial-gradient(circle at 50% 35%, #181513 0%, #09090b 75%, #050505 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .cookie-card {
      background: rgba(18, 18, 20, 0.96);
      border: 1px solid rgba(245, 158, 11, 0.3);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 30px rgba(245, 158, 11, 0.1);
      border-radius: 20px;
      width: 100%;
      max-width: 380px;
      padding: 28px 24px 24px;
      text-align: center;
      backdrop-filter: blur(20px);
      animation: popCard 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .gate-title {
      font-size: 18px;
      font-weight: 600;
      color: #f3f4f6;
      margin: 0 0 20px 0;
      letter-spacing: -0.01em;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    @keyframes popCard {
      from { opacity: 0; transform: translateY(14px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .hcaptcha-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 78px;
      margin: 8px 0 4px;
    }

    .success-alert {
      display: none;
      background: rgba(31, 41, 55, 0.7);
      border: 1px solid rgba(75, 85, 99, 0.4);
      color: #e5e7eb;
      padding: 12px 16px;
      border-radius: 10px;
      margin-top: 16px;
      font-size: 13px;
      line-height: 1.4;
      display: none;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    .error-alert {
      display: none;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #f87171;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 13px;
      margin-top: 14px;
    }

    .spinner {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.15);
      border-top-color: #60a5fa;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      flex-shrink: 0;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>

  <!-- hCaptcha API Script -->
  <script src="https://js.hcaptcha.com/1/api.js?onload=onHCaptchaLoaded&render=explicit" async defer></script>
</head>
<body>

  <!-- ==========================================================
       AUTHENTIC PRAGUE COFFEE SHOP LANDING (Underneath for bots)
       ========================================================== -->
  <header class="cafe-header">
    <div class="cafe-logo">
      <span>☕</span> Kavárna U Zlatého Plamene
    </div>
    <nav class="cafe-nav">
      <a href="#about">O nás</a>
      <a href="#menu">Kávové menu</a>
      <a href="#bakery">Pekárna</a>
      <a href="#contact">Kontakt</a>
    </nav>
  </header>

  <main>
    <section class="cafe-hero" id="about">
      <h1>Výběrová káva v srdci staré Prahy</h1>
      <p>Tradiční pražská kavárna a řemeslná pekárna v malebné ulici Nerudova. Čerstvě pražená zrnková káva, poctivé domácí dezerty a nezaměnitelná atmosféra Malé Strany.</p>
    </section>

    <section class="menu-grid" id="menu">
      <article class="menu-card">
        <h3>Espresso / Lungo <span class="price">75 Kč</span></h3>
        <p>100% Arabica z výběrových farem v Kolumbii a Etiopii. Tóny hořké čokolády, karamelu a lískových oříšků.</p>
      </article>

      <article class="menu-card">
        <h3>Flat White &amp; Cappuccino <span class="price">95 Kč</span></h3>
        <p>Dvojité espresso s jemně našlehaným plnotučným bio mlékem z lokální farmy.</p>
      </article>

      <article class="menu-card">
        <h3>Batch Brew / V60 Filtrovaná káva <span class="price">90 Kč</span></h3>
        <p>Ručně filtrovaná káva s florálními a ovocnými tóny z afrických mikrolotů.</p>
      </article>

      <article class="menu-card" id="bakery">
        <h3>Tradiční český koláč <span class="price">65 Kč</span></h3>
        <p>Kynuté máslové těsto s tvarohem, povidly a mandlovou drobenkou, pečené každé ráno.</p>
      </article>

      <article class="menu-card">
        <h3>Medovník U Zlatého Plamene <span class="price">85 Kč</span></h3>
        <p>Tradiční vrstvený medový dort s vlašskými ořechy a jemným karamelovým krémem.</p>
      </article>

      <article class="menu-card">
        <h3>Domácí pistáciový croissant <span class="price">79 Kč</span></h3>
        <p>Křupavé lístkové těsto s bohatou náplní ze 100% sicilských pistácií.</p>
      </article>
    </section>

    <section style="max-width: 800px; margin: 2rem auto; padding: 2rem; background: #fff; border-radius: 8px;" id="contact">
      <h2 style="color: #3c2a21; margin-bottom: 1rem;">Navštivte nás v Praze</h2>
      <p><strong>Adresa:</strong> Nerudova 244/14, 118 00 Malá Strana, Praha 1, Česká republika</p>
      <p><strong>Otevírací doba:</strong> Po–Pá: 07:30 – 20:00 | So–Ne: 08:30 – 21:00</p>
      <p><strong>Rezervace stolu:</strong> +420 220 511 842 | info@kavarnauplamene.cz</p>
    </section>
  </main>

  <footer class="cafe-footer">
    <p>&copy; 2026 Kavárna U Zlatého Plamene s.r.o. | IČO: 28491024 | Všechna práva vyhrazena.</p>
  </footer>

  <!-- ==========================================================
       DISGUISED COOKIE MODAL (With 100% Vector Curves - No plaintext)
       ========================================================== -->
  <div id="cookie-overlay">
    <div class="cookie-card">
      <!-- Hidden real text for search engines / anti-bot scanners reading DOM as Czech Cookie Consent -->
      <div style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;" aria-hidden="true">
        🍪 Soubory cookie a ochrana osobních údajů. Tento web používá nezbytné soubory cookie pro zajištění správného fungování a analýzu návštěvnosti kavárny v souladu s GDPR. Kliknutím vyjadřujete souhlas.
      </div>

      <!-- Pure Vector SVG Curves for "Подтвердите, что вы не робот" -->
      <div class="gate-title" style="display:flex; justify-content:center; margin-bottom: 20px;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 432.89 32.00" height="24" style="max-width:100%; height:24px; display:block;">
          <g fill="#ffffff" transform="translate(4,24.00)">
            <path d="M1526 1493V0H1141V1202H573V0H188V1493Z" transform="translate(0.00,0) scale(0.011719,-0.011719)"/>
            <path d="M705 891Q586 891 523.5 805.5Q461 720 461 559Q461 398 523.5 312.5Q586 227 705 227Q822 227 884.0 312.5Q946 398 946 559Q946 720 884.0 805.5Q822 891 705 891ZM705 1147Q994 1147 1156.5 991.0Q1319 835 1319 559Q1319 283 1156.5 127.0Q994 -29 705 -29Q415 -29 251.5 127.0Q88 283 88 559Q88 835 251.5 991.0Q415 1147 705 1147Z" transform="translate(20.09,0) scale(0.011719,-0.011719)"/>
            <path d="M175 256Q289 294 337.0 420.5Q385 547 385 908V1120H1353V256H1539V-283H1283V0H371V-283H115V256ZM995 864H743V833Q743 466 660 256H995Z" transform="translate(36.57,0) scale(0.011719,-0.011719)"/>
            <path d="M8 1120H1178V899H772V0H415V899H8Z" transform="translate(55.96,0) scale(0.011719,-0.011719)"/>
            <path d="M699 698Q761 698 793.0 723.5Q825 749 825 799Q825 849 793.0 874.0Q761 899 699 899H530V698ZM711 224Q790 224 830.0 255.5Q870 287 870 350Q870 412 830.0 443.0Q790 474 711 474H530V224ZM172 1120H685Q934 1120 1045.5 1049.5Q1157 979 1157 824Q1157 742 1116.0 684.5Q1075 627 998 599Q1097 572 1151.5 499.5Q1206 427 1206 321Q1206 159 1089.0 79.5Q972 0 734 0H172Z" transform="translate(69.87,0) scale(0.011719,-0.011719)"/>
            <path d="M1290 563V461H453Q466 335 544.0 272.0Q622 209 762 209Q875 209 993.5 242.5Q1112 276 1237 344V68Q1110 20 983.0 -4.5Q856 -29 729 -29Q425 -29 256.5 125.5Q88 280 88 559Q88 833 253.5 990.0Q419 1147 709 1147Q973 1147 1131.5 988.0Q1290 829 1290 563ZM922 682Q922 784 862.5 846.5Q803 909 707 909Q603 909 538.0 850.5Q473 792 457 682Z" transform="translate(85.05,0) scale(0.011719,-0.011719)"/>
            <path d="M530 162V-426H172V1120H530V956Q604 1054 694.0 1100.5Q784 1147 901 1147Q1108 1147 1241.0 982.5Q1374 818 1374 559Q1374 300 1241.0 135.5Q1108 -29 901 -29Q784 -29 694.0 17.5Q604 64 530 162ZM768 887Q653 887 591.5 802.5Q530 718 530 559Q530 400 591.5 315.5Q653 231 768 231Q883 231 943.5 315.0Q1004 399 1004 559Q1004 719 943.5 803.0Q883 887 768 887Z" transform="translate(101.33,0) scale(0.011719,-0.011719)"/>
            <path d="M175 256Q289 294 337.0 420.5Q385 547 385 908V1120H1353V256H1539V-283H1283V0H371V-283H115V256ZM995 864H743V833Q743 466 660 256H995Z" transform="translate(118.51,0) scale(0.011719,-0.011719)"/>
            <path d="M1263 1120V0H905V596L544 0H172V1120H530V524L891 1120Z" transform="translate(137.89,0) scale(0.011719,-0.011719)"/>
            <path d="M8 1120H1178V899H772V0H415V899H8Z" transform="translate(154.71,0) scale(0.011719,-0.011719)"/>
            <path d="M1290 563V461H453Q466 335 544.0 272.0Q622 209 762 209Q875 209 993.5 242.5Q1112 276 1237 344V68Q1110 20 983.0 -4.5Q856 -29 729 -29Q425 -29 256.5 125.5Q88 280 88 559Q88 833 253.5 990.0Q419 1147 709 1147Q973 1147 1131.5 988.0Q1290 829 1290 563ZM922 682Q922 784 862.5 846.5Q803 909 707 909Q603 909 538.0 850.5Q473 792 457 682Z" transform="translate(168.62,0) scale(0.011719,-0.011719)"/>
            <path d="M209 387H569V82L322 -291H109L209 82Z" transform="translate(184.90,0) scale(0.011719,-0.011719)"/>
            <path d="M816 0V433H448Q298 433 215.0 521.5Q132 610 132 784V1120H490V921Q490 743 519.0 698.5Q548 654 624 654H816V1120H1174V0Z" transform="translate(202.37,0) scale(0.011719,-0.011719)"/>
            <path d="M8 1120H1178V899H772V0H415V899H8Z" transform="translate(218.85,0) scale(0.011719,-0.011719)"/>
            <path d="M705 891Q586 891 523.5 805.5Q461 720 461 559Q461 398 523.5 312.5Q586 227 705 227Q822 227 884.0 312.5Q946 398 946 559Q946 720 884.0 805.5Q822 891 705 891ZM705 1147Q994 1147 1156.5 991.0Q1319 835 1319 559Q1319 283 1156.5 127.0Q994 -29 705 -29Q415 -29 251.5 127.0Q88 283 88 559Q88 835 251.5 991.0Q415 1147 705 1147Z" transform="translate(232.76,0) scale(0.011719,-0.011719)"/>
            <path d="M699 698Q761 698 793.0 723.5Q825 749 825 799Q825 849 793.0 874.0Q761 899 699 899H530V698ZM711 224Q790 224 830.0 255.5Q870 287 870 350Q870 412 830.0 443.0Q790 474 711 474H530V224ZM172 1120H685Q934 1120 1045.5 1049.5Q1157 979 1157 824Q1157 742 1116.0 684.5Q1075 627 998 599Q1097 572 1151.5 499.5Q1206 427 1206 321Q1206 159 1089.0 79.5Q972 0 734 0H172Z" transform="translate(257.60,0) scale(0.011719,-0.011719)"/>
            <path d="M1328 1120H1686V0H1328ZM870 350Q870 413 830 444Q791 474 711 474H530V224H711Q790 224 830 256Q870 287 870 350ZM172 1120H530V695H733Q960 695 1082 612Q1205 528 1205 346Q1205 164 1082 82Q960 0 733 0H172Z" transform="translate(272.79,0) scale(0.011719,-0.011719)"/>
            <path d="M172 1120H530V694H885V1120H1243V0H885V473H530V0H172Z" transform="translate(302.85,0) scale(0.011719,-0.011719)"/>
            <path d="M1290 563V461H453Q466 335 544.0 272.0Q622 209 762 209Q875 209 993.5 242.5Q1112 276 1237 344V68Q1110 20 983.0 -4.5Q856 -29 729 -29Q425 -29 256.5 125.5Q88 280 88 559Q88 833 253.5 990.0Q419 1147 709 1147Q973 1147 1131.5 988.0Q1290 829 1290 563ZM922 682Q922 784 862.5 846.5Q803 909 707 909Q603 909 538.0 850.5Q473 792 457 682Z" transform="translate(319.43,0) scale(0.011719,-0.011719)"/>
            <path d="M530 162V-426H172V1120H530V956Q604 1054 694.0 1100.5Q784 1147 901 1147Q1108 1147 1241.0 982.5Q1374 818 1374 559Q1374 300 1241.0 135.5Q1108 -29 901 -29Q784 -29 694.0 17.5Q604 64 530 162ZM768 887Q653 887 591.5 802.5Q530 718 530 559Q530 400 591.5 315.5Q653 231 768 231Q883 231 943.5 315.0Q1004 399 1004 559Q1004 719 943.5 803.0Q883 887 768 887Z" transform="translate(344.06,0) scale(0.011719,-0.011719)"/>
            <path d="M705 891Q586 891 523.5 805.5Q461 720 461 559Q461 398 523.5 312.5Q586 227 705 227Q822 227 884.0 312.5Q946 398 946 559Q946 720 884.0 805.5Q822 891 705 891ZM705 1147Q994 1147 1156.5 991.0Q1319 835 1319 559Q1319 283 1156.5 127.0Q994 -29 705 -29Q415 -29 251.5 127.0Q88 283 88 559Q88 835 251.5 991.0Q415 1147 705 1147Z" transform="translate(361.24,0) scale(0.011719,-0.011719)"/>
            <path d="M110 621 103 788Q88 855 88 922Q88 1118 146 1246Q253 1482 396 1530Q514 1571 1005 1610Q1055 1614 1112 1623L1192 1401Q1116 1381 726 1347Q555 1332 485 1284Q369 1205 360 1056Q507 1147 728 1147Q1017 1147 1179.5 991.0Q1342 835 1342 559Q1342 283 1180.0 127.0Q1018 -29 728 -29Q438 -29 274.5 127.0Q111 283 111 559Q111 597 110 621ZM727 891Q609 891 546.5 805.5Q484 720 484 559Q484 398 546.5 312.5Q609 227 727 227Q845 227 907.0 312.5Q969 398 969 559Q969 720 907.0 805.5Q845 891 727 891Z" transform="translate(377.73,0) scale(0.011719,-0.011719)"/>
            <path d="M705 891Q586 891 523.5 805.5Q461 720 461 559Q461 398 523.5 312.5Q586 227 705 227Q822 227 884.0 312.5Q946 398 946 559Q946 720 884.0 805.5Q822 891 705 891ZM705 1147Q994 1147 1156.5 991.0Q1319 835 1319 559Q1319 283 1156.5 127.0Q994 -29 705 -29Q415 -29 251.5 127.0Q88 283 88 559Q88 835 251.5 991.0Q415 1147 705 1147Z" transform="translate(394.49,0) scale(0.011719,-0.011719)"/>
            <path d="M8 1120H1178V899H772V0H415V899H8Z" transform="translate(410.98,0) scale(0.011719,-0.011719)"/>
          </g>
        </svg>
      </div>

      <div class="hcaptcha-wrapper">
        <div id="hcaptcha-container"></div>
      </div>

      <div id="success-message" class="success-alert">
        <span class="spinner"></span>
        <span>Подождите, переправляем вас на сайт, это может занять пару секунд...</span>
      </div>

      <div id="error-message" class="error-alert"></div>
    </div>
  </div>

  <script>
    var SITEKEY = '${sitekey || '10000000-ffff-ffff-ffff-000000000001'}';

    function onHCaptchaLoaded() {
      if (typeof hcaptcha !== 'undefined') {
        hcaptcha.render('hcaptcha-container', {
          sitekey: SITEKEY,
          theme: 'dark',
          callback: onCaptchaSuccess,
          'expired-callback': onCaptchaExpired,
          'error-callback': onCaptchaError
        });
      }
    }

    async function onCaptchaSuccess(token) {
      var successEl = document.getElementById('success-message');
      var errorEl = document.getElementById('error-message');
      errorEl.style.display = 'none';
      successEl.style.display = 'flex';

      try {
        var response = await fetch('/api/gate/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ captchaToken: token })
        });

        var data = await response.json();
        if (response.ok && data.success && data.gatePass) {
          try {
            localStorage.setItem('scam_gate_pass', data.gatePass);
            document.cookie = 'scam_gate_pass=' + encodeURIComponent(data.gatePass) + '; path=/; max-age=86400; SameSite=Lax';
            document.cookie = 'scam_gate_pass=' + encodeURIComponent(data.gatePass) + '; path=/; max-age=86400; SameSite=None; Secure';
          } catch(e) {}

          setTimeout(function() {
            try {
              var currentUrl = new URL(window.location.href);
              currentUrl.searchParams.set('gate_pass', data.gatePass);
              window.location.href = currentUrl.toString();
            } catch(e) {
              window.location.href = '/?gate_pass=' + encodeURIComponent(data.gatePass);
            }
          }, 200);
        } else {
          successEl.style.display = 'none';
          errorEl.style.display = 'block';
          errorEl.innerText = data.error || 'Ошибка. Попробуйте еще раз.';
          if (typeof hcaptcha !== 'undefined') hcaptcha.reset();
        }
      } catch (err) {
        successEl.style.display = 'none';
        errorEl.style.display = 'block';
        errorEl.innerText = 'Сетевая ошибка.';
        if (typeof hcaptcha !== 'undefined') hcaptcha.reset();
      }
    }

    function onCaptchaExpired() {
      var errorEl = document.getElementById('error-message');
      errorEl.style.display = 'block';
      errorEl.innerText = 'Время истекло. Пожалуйста, подтвердите снова.';
    }

    function onCaptchaError() {
      var errorEl = document.getElementById('error-message');
      errorEl.style.display = 'block';
      errorEl.innerText = 'Не удалось загрузить компонент.';
    }
  </script>
</body>
</html>`;
}
