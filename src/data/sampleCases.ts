import { SampleCase, VoiceTurn } from '../engine/types';

export const SAMPLE_CASES: SampleCase[] = [
  // 1. Legitimate Communications (Prove low false-positive rate)
  {
    id: 'legit-bank-alert',
    title: 'Genuine Bank Card Transaction Alert',
    channel: 'sms',
    category: 'legitimate',
    expectedLabel: 'safe',
    language: 'English',
    senderLabel: 'Chase Alerts (24273)',
    content:
      "Chase Alert: Your debit card ending in 4821 was charged $24.50 at Trader Joe's. If you recognize this purchase, no action is needed.",
    contextNote:
      'Contains financial brand name and dollar amount, but zero links, zero urgency, and explicit "no action needed" framing.',
  },
  {
    id: 'legit-2fa-warning',
    title: 'Authentic 2FA Security Code Notice',
    channel: 'sms',
    category: 'legitimate',
    expectedLabel: 'safe',
    language: 'English',
    senderLabel: 'Bank Security',
    content:
      'Your one-time verification code is 849201. Bank staff will NEVER call or ask you for this code. Do not share it with anyone.',
    contextNote:
      'Tests contextual AI understanding: mentions "verification code" and "do not share", yet is a protective anti-scam notice rather than an extraction attempt.',
  },
  {
    id: 'legit-clinic-reminder',
    title: 'Healthcare Appointment Reminder',
    channel: 'sms',
    category: 'legitimate',
    expectedLabel: 'safe',
    language: 'English',
    senderLabel: 'Oakridge Clinic',
    content:
      'Reminder: You have an appointment with Dr. Patel tomorrow at 10:30 AM at Oakridge Medical Center. Reply C to confirm or call our front desk to reschedule.',
    contextNote: 'Standard clinical appointment SMS with no external phishing links or credential requests.',
  },
  {
    id: 'legit-official-url',
    title: 'Verified Official Domain Link',
    channel: 'url',
    category: 'legitimate',
    expectedLabel: 'safe',
    language: 'English',
    senderLabel: 'Direct URL Check',
    content: 'https://www.paypal.com/myaccount/summary',
    contextNote: 'Exact official registrable domain (paypal.com) over HTTPS with standard account path.',
  },

  // 2. Known Scam Patterns
  {
    id: 'scam-usps-delivery',
    title: 'Parcel Customs Fee Phishing SMS',
    channel: 'sms',
    category: 'known_scam',
    expectedLabel: 'scam',
    language: 'English',
    senderLabel: '+44 7911 882104',
    content:
      'USPS Final Notice: Your package delivery failed due to an unpaid $2.95 customs fee. Update your shipping address within 12 hours to avoid return: https://usps-redelivery-fee.top/confirm',
    contextNote: 'Classic parcel lure combining deadline pressure, small fee bait, and impersonated .top domain.',
  },
  {
    id: 'scam-bank-freeze',
    title: 'Account Suspension Credential Trap',
    channel: 'sms',
    category: 'known_scam',
    expectedLabel: 'scam',
    language: 'English',
    senderLabel: 'Alert-Center',
    content:
      'URGENT: Unusual activity detected on your Wells Fargo account. Your access has been frozen. Confirm your identity and 6-digit OTP immediately at http://wellsfargo.com.verify-unlock.xyz/login',
    contextNote: 'Subdomain brand spoofing (wellsfargo.com inside verify-unlock.xyz), unencrypted HTTP, urgency, and OTP harvesting.',
  },
  {
    id: 'scam-tech-support',
    title: 'Tech Support Remote Access Pop-up',
    channel: 'email',
    category: 'known_scam',
    expectedLabel: 'scam',
    language: 'English',
    senderLabel: 'support-desk@win-protect.icu',
    content:
      'Microsoft Security Team Alert: Trojan spyware detected on your Windows PC. Your banking details are at risk. Call +1-888-555-0194 immediately and install AnyDesk so our technician can secure your files. Do not shut down or tell anyone until resolved.',
    contextNote: 'Impersonates Microsoft, uses fear urgency, demands remote desktop software (AnyDesk), and enforces secrecy.',
  },

  // 3. Unseen, Novel & Obfuscated Scams (Adaptability demonstration)
  {
    id: 'unseen-homoglyph-url',
    title: 'Zero-Day Cyrillic Homoglyph Phish',
    channel: 'sms',
    category: 'unseen_obfuscated',
    expectedLabel: 'scam',
    language: 'English',
    senderLabel: 'Secur1ty',
    content:
      'Notice: A new device signed into your account from Prague. If this was not you, secure your wallet right now via https://pаypаl.com/auth-check',
    contextNote:
      'Uses Cyrillic "а" (U+0430) inside "pаypаl.com" so it looks visually identical to paypal.com. Exposed by local homoglyph normalizer.',
  },
  {
    id: 'unseen-leetspeak-evasion',
    title: 'Adversarial Leetspeak & Zero-Width Evasion',
    channel: 'sms',
    category: 'unseen_obfuscated',
    expectedLabel: 'scam',
    language: 'English',
    senderLabel: 'Unknown Sender',
    content:
      'F1nal W4rning: Your C0inbase w4llet is l0cked. V3rify your s33d phr4se before midnight to prevent asset loss: hxxps://coinbase-recovery[.]click/restore',
    contextNote:
      'Substitutes letters with digits (F1nal, w4llet, s33d phr4se) and defangs URL (hxxps, [.]) to bypass rigid keyword rules.',
  },
  {
    id: 'unseen-grandparent-emergency',
    title: 'Novel "New Number" Family Emergency Scam',
    channel: 'sms',
    category: 'unseen_obfuscated',
    expectedLabel: 'scam',
    language: 'English',
    senderLabel: '+1 (305) 555-0147',
    content:
      "Hey Grandma, I lost my wallet at the airport and my phone broke, so I'm texting from a friend's number. Please send $950 via Zelle to his account right now so I can get a ticket home, and please don't tell Mom yet so she doesn't worry.",
    contextNote:
      'No URLs and no banking brand keywords. Detected via semantic intent + isolation ("don\'t tell Mom") + irreversible payment + new-number excuse.',
  },
  {
    id: 'unseen-hr-payroll',
    title: 'AI-Crafted Corporate Payroll Compliance Lure',
    channel: 'email',
    category: 'unseen_obfuscated',
    expectedLabel: 'scam',
    language: 'English',
    senderLabel: 'people-ops@corp-benefits.top',
    content:
      'HR Department Notice: Updated Q4 direct deposit compliance requires all staff to re-authenticate their employee payroll profile before 5pm today to avoid delayed salary disbursement: https://portal.workday-sync.top/reauth',
    contextNote:
      'Polished business tone without classic spam typos; caught by Workday subdomain/TLD structural deception and deadline framing.',
  },

  // 4. Multilingual Scams
  {
    id: 'multi-spanish-bank',
    title: 'Spanish Banking Suspension Phish',
    channel: 'sms',
    category: 'multilingual',
    expectedLabel: 'scam',
    language: 'Spanish',
    senderLabel: 'BancoSeguridad',
    content:
      'Alerta de seguridad bancaria: Su tarjeta fue bloqueada temporalmente por actividad inusual. Verifique su clave de inmediato en http://seguridad-banco.xyz/clave',
    contextNote: 'Spanish-language phishing detected offline via multilingual subword semantic vectors + .xyz HTTP link.',
  },
  {
    id: 'multi-hinglish-kyc',
    title: 'Hindi / Hinglish KYC Expiry Scam',
    channel: 'sms',
    category: 'multilingual',
    expectedLabel: 'scam',
    language: 'Hindi / Hinglish',
    senderLabel: '+91 98110 55421',
    content:
      'Aapka bank KYC update pending hai. Aaj shaam 6 baje tak link par OTP verify karein warna aapka khata band ho jayega: https://sbi-kyc-update.buzz/verify',
    contextNote: 'Hinglish banking scam combining KYC urgency, OTP extraction, and lookalike SBI .buzz domain.',
  },
  {
    id: 'multi-french-parcel',
    title: 'French Customs Parcel Phishing',
    channel: 'sms',
    category: 'multilingual',
    expectedLabel: 'scam',
    language: 'French',
    senderLabel: 'Chronopost-Info',
    content:
      'Votre colis est retenu en douane. Veuillez cliquer sur le lien pour confirmer votre carte bancaire immediatement: https://colis-suivi-fr.top/payer',
    contextNote: 'French delivery scam caught by multilingual subword prototype similarity and suspicious .top URL.',
  },
];

export interface VoiceScenario {
  id: string;
  title: string;
  category: 'scam' | 'legitimate';
  callerLabel: string;
  summary: string;
  turns: VoiceTurn[];
}

export const VOICE_SCENARIOS: VoiceScenario[] = [
  {
    id: 'voice-bank-otp',
    title: 'Bank Fraud Dept OTP Extraction Call',
    category: 'scam',
    callerLabel: 'Spoofed Bank Fraud Desk',
    summary: 'Caller impersonates bank security, induces panic over a fake wire, then asks the victim to read back a 6-digit OTP code.',
    turns: [
      {
        id: 't1',
        speaker: 'caller',
        timestampSec: 4,
        text: 'Hello, this is Marcus from the Chase Fraud Department calling on a recorded line regarding your checking account.',
      },
      {
        id: 't2',
        speaker: 'recipient',
        timestampSec: 11,
        text: 'Oh, hello. Is something wrong with my card?',
      },
      {
        id: 't3',
        speaker: 'caller',
        timestampSec: 18,
        text: 'Yes, an unauthorized wire transfer of $3,400 was just attempted from Miami. Your account will be frozen in 10 minutes unless we cancel it immediately.',
      },
      {
        id: 't4',
        speaker: 'recipient',
        timestampSec: 27,
        text: 'I did not make any transfer! How do we stop it?',
      },
      {
        id: 't5',
        speaker: 'caller',
        timestampSec: 34,
        text: 'Stay on the line and do not hang up or tell anyone while we secure your funds. I just sent a 6-digit OTP verification code to your phone—please read that passcode back to me right now.',
      },
    ],
  },
  {
    id: 'voice-irs-giftcard',
    title: 'Federal Tax Warrant & Gift Card Extortion',
    category: 'scam',
    callerLabel: '+1 (202) 555-0183',
    summary: 'Threatens immediate arrest warrant unless back taxes are settled via gift cards while demanding strict secrecy.',
    turns: [
      {
        id: 'g1',
        speaker: 'caller',
        timestampSec: 3,
        text: 'This is Officer Davis from the IRS Federal Enforcement Division. An arrest warrant has been issued under your Social Security number.',
      },
      {
        id: 'g2',
        speaker: 'recipient',
        timestampSec: 12,
        text: 'An arrest warrant? I paid my taxes in April.',
      },
      {
        id: 'g3',
        speaker: 'caller',
        timestampSec: 20,
        text: 'Our records show an unpaid penalty of $1,800. Local police are scheduled to arrive within 45 minutes unless you resolve this urgent hold right now.',
      },
      {
        id: 'g4',
        speaker: 'caller',
        timestampSec: 31,
        text: 'Keep this confidential and do not tell your family or store clerks. Go to the nearest pharmacy, purchase Apple gift cards for $1,800, and read me the numbers on the back.',
      },
    ],
  },
  {
    id: 'voice-tech-anydesk',
    title: 'Tech Support Refund & AnyDesk Trap',
    category: 'scam',
    callerLabel: 'Windows Security Desk',
    summary: 'Claims computer license expired and pressures the user into installing remote-access software.',
    turns: [
      {
        id: 'a1',
        speaker: 'caller',
        timestampSec: 5,
        text: 'Good afternoon, calling from Microsoft Support regarding your auto-renewal charge of $499.',
      },
      {
        id: 'a2',
        speaker: 'recipient',
        timestampSec: 12,
        text: 'I never signed up for an auto-renewal.',
      },
      {
        id: 'a3',
        speaker: 'caller',
        timestampSec: 19,
        text: 'To process your refund immediately before the billing batch closes today, please open your browser and install AnyDesk so I can screen share and connect you to our refund portal.',
      },
    ],
  },
  {
    id: 'voice-legit-pharmacy',
    title: 'Legitimate Local Pharmacy Pickup Call',
    category: 'legitimate',
    callerLabel: 'Neighborhood Pharmacy',
    summary: 'Routine informational call confirming prescription readiness with zero urgency, secrecy, or credential requests.',
    turns: [
      {
        id: 'l1',
        speaker: 'caller',
        timestampSec: 4,
        text: 'Hello, this is a courtesy call from Oakridge Pharmacy letting you know your regular prescription is ready for pickup.',
      },
      {
        id: 'l2',
        speaker: 'recipient',
        timestampSec: 11,
        text: 'Thank you, what time do you close tonight?',
      },
      {
        id: 'l3',
        speaker: 'caller',
        timestampSec: 17,
        text: 'We are open until 7 PM today and 5 PM tomorrow. No action is needed on your phone—just stop by the counter whenever convenient.',
      },
    ],
  },
];
