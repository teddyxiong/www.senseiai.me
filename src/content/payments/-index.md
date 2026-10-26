---
meta_title: "Payment Options | Linkjob AI"
meta_description: "Choose your preferred payment method for Linkjob AI subscription. We support Stripe, LemonSqueezy, PayPal, and USDT payments for your convenience."
title: "Choose Your Payment Method"
description: "Select your preferred payment option to complete your Linkjob AI subscription"

# Payment Methods Configuration
payment_methods:
  monthly:
    - payment_company: "stripe"
      payment_name: "Credit Card (Stripe)"
      payment_logo: "/images/payments/stripe-logo.svg"
      payment_description: "Pay securely with your credit or debit card via Stripe"
      payment_link: "https://buy.stripe.com/aFa8wPdeq5yEbmW0XV6EU09"
      is_active: true
      is_visible: true
      display_order: 1
    
    - payment_company: "lemonsqueezy"
      payment_name: "LemonSqueezy Checkout"
      payment_logo: "/images/payments/lemonsqueezy-logo.svg"
      payment_description: "Simple and secure payment processing"
      payment_link: "https://linkjob.lemonsqueezy.com/checkout/monthly"
      is_active: false
      is_visible: false
      display_order: 2
    
    - payment_company: "paypal"
      payment_name: "PayPal"
      payment_logo: "/images/payments/paypal-logo.svg"
      payment_description: "Pay with your PayPal account or credit card"
      payment_link: "https://paypal.com/linkjob/monthly"
      is_active: false
      is_visible: false
      display_order: 3
    
    - payment_company: "usdt"
      payment_name: "USDT (Cryptocurrency)"
      payment_logo: "/images/payments/usdt-logo.svg"
      payment_description: "Pay with USDT cryptocurrency"
      payment_link: "https://crypto.senseiai.me/usdt/monthly"
      is_active: false
      is_visible: false
      display_order: 4

    - payment_company: "usdc"
      payment_name: "USDC (Cryptocurrency)"
      payment_logo: "/images/payments/usdc-logo.svg"
      payment_description: "Pay with USDc cryptocurrency"
      payment_link: "https://crypto.senseiai.me/usdt/monthly"
      is_active: false
      is_visible: false
      display_order: 4

    - payment_company: "gpay"
      payment_name: "Google Pay"
      payment_logo: "/images/payments/googlepay-logo.svg"
      payment_description: "Pay with Google Pay"
      payment_link: "https://crypto.senseiai.me/gpay/monthly"
      is_active: false
      is_visible: false
      display_order: 4

    - payment_company: "Apple pay"
      payment_name: "Apple Pay"
      payment_logo: "/images/payments/applepay-logo.svg"
      payment_description: "Pay with Apple Pay"
      payment_link: "https://crypto.senseiai.me/applepay/monthly"
      is_active: false
      is_visible: false
      display_order: 4

    - payment_company: "wepay"
      payment_name: "WePay"
      payment_logo: "/images/payments/wechatpay-logo.svg"
      payment_description: "Pay with WePay"
      payment_link: "https://crypto.senseiai.me/wepay/monthly"
      is_active: false
      is_visible: false
      display_order: 4

    - payment_company: "alipay"
      payment_name: "Alipay"
      payment_logo: "/images/payments/alipay-logo.svg"
      payment_description: "Pay with Alipay"
      payment_link: "https://crypto.senseiai.me/alipay/monthly"
      is_active: false
      is_visible: false
      display_order: 4

  quarterly:
    - payment_company: "stripe"
      payment_name: "Credit Card (Stripe)"
      payment_logo: "/images/payments/stripe-logo.svg"
      payment_description: "Pay securely with your credit or debit card via Stripe"
      payment_link: "https://buy.stripe.com/6oU14n5LY9OU1MmgWT6EU0a"
      is_active: true
      is_visible: true
      display_order: 1
    
    - payment_company: "lemonsqueezy"
      payment_name: "LemonSqueezy Checkout"
      payment_logo: "/images/payments/lemonsqueezy-logo.svg"
      payment_description: "Simple and secure payment processing"
      payment_link: "https://linkjob.lemonsqueezy.com/checkout/quarterly"
      is_active: false
      is_visible: false
      display_order: 2
    
    - payment_company: "paypal"
      payment_name: "PayPal"
      payment_logo: "/images/payments/paypal-logo.svg"
      payment_description: "Pay with your PayPal account or credit card"
      payment_link: "https://paypal.com/linkjob/quarterly"
      is_active: false
      is_visible: false
      display_order: 3
    
    - payment_company: "usdt"
      payment_name: "USDT (Cryptocurrency)"
      payment_logo: "/images/payments/usdt-logo.svg"
      payment_description: "Pay with USDT cryptocurrency"
      payment_link: "https://crypto.senseiai.me/usdt/quarterly"
      is_active: false
      is_visible: false
      display_order: 4

  annually:
    - payment_company: "stripe"
      payment_name: "Credit Card (Stripe)"
      payment_logo: "/images/payments/stripe-logo.svg"
      payment_description: "Pay securely with your credit or debit card via Stripe"
      payment_link: "https://buy.stripe.com/aFacN5a2eaSY2QqfSP6EU0b"
      is_active: true
      is_visible: true
      display_order: 1
    
    - payment_company: "lemonsqueezy"
      payment_name: "LemonSqueezy Checkout"
      payment_logo: "/images/payments/lemonsqueezy-logo.svg"
      payment_description: "Simple and secure payment processing"
      payment_link: "https://linkjob.lemonsqueezy.com/checkout/annually"
      is_active: false
      is_visible: false
      display_order: 2
    
    - payment_company: "paypal"
      payment_name: "PayPal"
      payment_logo: "/images/payments/paypal-logo.svg"
      payment_description: "Pay with your PayPal account or credit card"
      payment_link: "https://paypal.com/linkjob/annually"
      is_active: false
      is_visible: false
      display_order: 3
    
    - payment_company: "usdt"
      payment_name: "USDT (Cryptocurrency)"
      payment_logo: "/images/payments/usdt-logo.svg"
      payment_description: "Pay with USDT cryptocurrency"
      payment_link: "https://crypto.senseiai.me/usdt/annually"
      is_active: false
      is_visible: false
      display_order: 4

# Payment Type Labels
payment_types:
  monthly:
    label: "Monthly Subscription"
    description: "Pay monthly for maximum flexibility"
  quarterly:
    label: "Quarterly Subscription"
    description: "Save with our 3-month plan"
  annually:
    label: "Annual Subscription"
    description: "Best value - save up to 40% with yearly billing"
---