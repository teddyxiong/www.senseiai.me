import { defineCollection, z } from "astro:content";

// Post collection schema
const blogCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    meta_title: z.string().optional(),
    description: z.string().optional(),
    date: z.date().optional(),
    image: z.string().optional(),
    author: z.string().default("Admin"),
    author_image: z.string().default("/images/blog/avatar.png").optional(),
    categories: z.array(z.string()).default(["others"]),
    tags: z.array(z.string()).default(["others"]),
    draft: z.boolean().optional(),
  }),
});

// Author collection schema
const authorsCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    meta_title: z.string().optional(),
    email: z.string().optional(),
    image: z.string().optional(),
    description: z.string().optional(),
    social: z
      .array(
        z
          .object({
            name: z.string().optional(),
            icon: z.string().optional(),
            link: z.string().optional(),
          })
          .optional(),
      )
      .optional(),
    draft: z.boolean().optional(),
  }),
});

// Pages collection schema
const pagesCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    meta_title: z.string().optional(),
    description: z.string().optional(),
    canonical: z.string().optional(),
    image: z.string().optional(),
    draft: z.boolean().optional(),
    noindex: z.boolean().optional(),
    sitemap: z.boolean().optional(),
  }),
});

const membershipPageCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    meta_title: z.string().optional(),
    description: z.string().optional(),
    canonical: z.string().optional(),
    image: z.string().optional(),
    draft: z.boolean().optional(),
  }),
});

const cartPageCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    meta_title: z.string().optional(),
    description: z.string().optional(),
    canonical: z.string().optional(),
    image: z.string().optional(),
    ui_text: z.object({
      choose_plan_title: z.string(),
      choose_plan_desc: z.string(),
      choose_plan_meta: z.string(),
      subscription_title: z.string(),
      one_time_title: z.string(),
      missing_payment_message: z.string(),
      contact_html: z.string(),
      choose_method_title: z.string(),
      choose_method_desc: z.string(),
      choose_method_status: z.string(),
      loading_message: z.string(),
    }),
    plan_groups: z.array(
      z.object({
        title: z.string(),
        items: z.array(
          z.object({
            pid: z.string(),
            label: z.string(),
          })
        ),
      })
    ),
    draft: z.boolean().optional(),
  }),
});

const homePageCollection = defineCollection({
  schema: z.object({
    // Banner Section
    banner: z.object({
      title: z.string(),
      title2: z.string(),
      content: z.string(),
      content2: z.string(),
      badge: z.string(),
      image: z.string(),
      button: z.object({
        enable: z.boolean(),
        label: z.string(),
        link: z.string(),
      }),
      video_button: z.object({
        enable: z.boolean(),
        label: z.string(),
        link: z.string(),
      }),
      button2: z.object({
        enable: z.boolean(),
        label: z.string(),
        link: z.string(),
      }),
    }),

    hero_stats: z.array(
      z.object({
        value: z.string(),
        label: z.string(),
      }),
    ),

    company_logos: z.array(
      z.object({
        image: z.string(),
        alt: z.string(),
      }),
    ),

    // Brands Section
    brands: z.object({
      enable: z.boolean(),
      title: z.string(),
      logos: z.array(
        z.object({
          image: z.string(),
        }),
      ),
    }),

    // Experience Section
    experience: z.object({
      enable: z.boolean(),
      title: z.string(),
      description: z.string(),
      image: z.string(),
      items: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          icon: z.string(),
        }),
      ),
      title2: z.string(),
      description2: z.string(),
      image2: z.string(),
      items2: z.array(
        z.object({
          title2: z.string(),
          description2: z.string(),
          icon2: z.string(),
        }),
      ),
      counter: z.object({
        enable: z.boolean(),
        stats: z.array(
          z.object({
            title: z.string(),
            value: z.number(),
            suffix: z.string(),
          }),
        ),
      }),
    }),
  }),
});

const faqPageCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    description: z.string(),
    meta_title: z.string().optional(),
    accordion: z.object({
      enable: z.boolean(),
      items: z.array(
        z.object({
          accordion_header: z.string(),
          accordion_content: z.string(),
        }),
      ),
    }),
  }),
});

const testimonialsCollection = defineCollection({
  schema: z.object({
    enable: z.boolean(),
    title: z.string(),
    description: z.string(),
    testimonials: z.array(
      z.object({
        name: z.string(),
        designation: z.string(),
        avatar: z.string(),
        content: z.string(),
      }),
    ),
  }),
});

const callToActionCollection = defineCollection({
  schema: z.object({
    enable: z.boolean(),
    title: z.string(),
    description: z.string(),
    button: z.object({
      enable: z.boolean(),
      label: z.string(),
      link: z.string(),
    }),
  }),
});

const featuresCollection = defineCollection({
  schema: z.object({
    enable: z.boolean(),
    title: z.string(),
    description: z.string(),
    features: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        icon: z.string(),
      }),
    ),
  }),
});

const featuresPageCollection = defineCollection({
  schema: z.object({
    enable: z.boolean(),
    title: z.string(),
    meta_title: z.string().optional(),
    meta_description: z.string().optional(),
    description: z.string().optional(),
    feature_items: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        image: z.string(),
        lists: z.array(z.string()).optional(),
        button: z
          .object({
            enable: z.boolean(),
            label: z.string(),
            link: z.string(),
          })
          .optional(),
        items: z
          .array(
            z.object({
              title: z.string(),
              description: z.string(),
            }),
          )
          .optional(),
      }),
    ),
    features_v2: z
      .object({
        enable: z.boolean(),
        header: z.object({
          title_line_1: z.string(),
          title_line_2: z.string(),
        }),
        hero_card: z.object({
          title: z.string(),
          description: z.string(),
          video: z.object({
            src: z.string(),
            title: z.string(),
            min_height_px: z.number().optional(),
            cover_image: z.string().optional(),
            play_button_image: z.string().optional(),
          }),
        }),
        cards: z.object({
          pressure: z.object({
            title: z.string(),
            description: z.string(),
          }),
          personalized: z.object({
            title: z.string(),
            description: z.string(),
            image: z.string().optional(),
            image_alt: z.string().optional(),
          }),
          platform: z.object({
            title: z.string(),
            description: z.string(),
          }),
          interview_types: z.object({
            title: z.string(),
            description: z.string(),
          }),
        }),
      })
      .optional(),
    features_mock: z
      .object({
        enable: z.boolean(),
        section_description: z.string().optional(),
        header: z.object({
          title_line_1: z.string(),
          title_line_2: z.string(),
        }),
        hero_card: z.object({
          title: z.string(),
          description: z.string(),
          image: z.string().optional(),
          image_alt: z.string().optional(),
          video: z.object({
            src: z.string(),
            title: z.string(),
            min_height_px: z.number().optional(),
          }),
        }),
        cards: z.object({
          pressure: z.object({
            title: z.string(),
            description: z.string(),
            image: z.string().optional(),
            image_alt: z.string().optional(),
          }),
          personalized: z.object({
            title: z.string(),
            description: z.string(),
            image: z.string(),
            image_alt: z.string().optional(),
          }),
          platform: z.object({
            title: z.string(),
            description: z.string(),
            image: z.string().optional(),
            image_alt: z.string().optional(),
          }),
          interview_types: z.object({
            title: z.string(),
            description: z.string(),
            image: z.string().optional(),
            image_alt: z.string().optional(),
          }),
        }),
      })
      .optional(),
  }),
});

const legacyPricingPageCollection = defineCollection({
  schema: z.object({
    meta_title: z.string().optional(),
    meta_description: z.string().optional(),
    pricing: z.object({
      enable: z.boolean(),
      title: z.string(),
      pricing_tabs: z.object({
        one_time: z.string().optional(),
        subscription: z.string().optional(),
        monthly: z.string(),
        annually: z.string(),
        discounts: z.object({
          enable: z.boolean(),
          discount: z.number(),
        }),
        hint_text: z.string().optional(),
        hint_link: z.string().optional(),
      }),
      pricing_tables: z.array(
        z.object({
          plan_key: z.string().optional(),
          switchable: z.boolean().optional(),
          title: z.string(),
          description: z.string(),
          prefix: z.string(),
          fixed_price: z.number().optional(),
          monthly_price: z.number(),
          annually_price: z.number(),
          billing: z
            .object({
              one_time: z.object({
                price: z.number(),
                link: z.string(),
              }),
              subscription: z.object({
                price: z.number(),
                link: z.string(),
              }),
            })
            .optional(),
          popular: z.boolean(),
          button: z.object({
            enable: z.boolean(),
            label: z.string(),
            link: z.string(),
          }),
          ai_models: z
            .object({
              title: z.string(),
              items: z.array(
                z.object({
                  name: z.string(),
                  logo: z.string(),
                })
              ),
            })
            .optional(),
          features: z.object({
            title: z.string(),
            list: z.array(z.string()),
            button: z.object({
              enable: z.boolean(),
              label: z.string(),
              link: z.string(),
            }),
          }),
        }),
      ),
    }),
    pricing_table_data: z.object({
      enable: z.boolean(),
      title: z.string(),
      tableHead: z.object({
        name: z.string(),
        free: z.string(),
        basic: z.string(),
        pro: z.string(),
        yearly: z.string(),
      }),
      tableBody: z.array(
        z.object({
          name: z.string(),
          info: z.string(),
          free: z.string(),
          basic: z.string(),
          pro: z.string(),
          yearly: z.string(),
        }),
      ),
      tableFooter: z.object({
        free: z.object({
          label: z.string(),
          link: z.string(),
        }),
        basic: z.object({
          label: z.string(),
          link: z.string(),
        }),
        pro: z.object({
          label: z.string(),
          link: z.string(),
        }),
        yearly: z.object({
          label: z.string(),
          link: z.string(),
        }),
      }),
    }),
  }),
});

const pricingPageCollection = defineCollection({
  schema: z.object({
    canonical: z.string().optional(),
    meta_title: z.string().optional(),
    meta_description: z.string().optional(),
    pricing: z.object({
      enable: z.boolean(),
      header: z.object({
        title: z.string(),
        subtitle_line_1: z.string(),
        subtitle_line_2: z.string(),
        tabs: z.object({
          one_time_label: z.string(),
          subscription_label: z.string(),
          subscription_extra_text: z.string().optional(),
          hint_text: z.string().optional(),
          hint_link: z.string().optional(),
        }),
        badges: z
          .array(
            z.object({
              text: z.string(),
              icon: z.string(),
              link: z.string().optional(),
            })
          )
          .optional(),
      }),
      plans: z.array(
        z.object({
          plan_key: z.string(),
          title: z.string(),
          is_lifetime: z.boolean().optional(),
          is_free: z.boolean().optional(),
          top_badge: z.string().optional(),
          badge: z
            .object({
              text: z.string().optional(),
              save_label: z.string().optional(),
              save_value: z.string().optional(),
            })
            .optional(),
          switchable: z.boolean().optional(),
          price: z.object({
            prefix: z.string().optional(),
            subscription: z.object({
              value: z.string(),
              suffix: z.string().optional(),
              note: z.string().optional(),
              paypal_link: z.string().optional(),
            }),
            one_time: z.object({
              value: z.string(),
              suffix: z.string().optional(),
              note: z.string().optional(),
              paypal_link: z.string().optional(),
            }),
          }),
          payments: z
            .array(
              z.object({
                provider: z.string(),
                label: z.string(),
                logo: z.string().optional(),
                modes: z.object({
                  subscription: z
                    .object({
                      link: z.string().optional(),
                    })
                    .optional(),
                  one_time: z
                    .object({
                      link: z.string().optional(),
                    })
                    .optional(),
                }),
              })
            )
            .optional(),
          ai_models: z
            .object({
              title: z.string(),
              items: z.array(
                z.object({
                  name: z.string(),
                  logo: z.string(),
                  tag: z.string().optional(),
                })
              ),
            })
            .optional(),
          features: z
            .object({
              title: z.string(),
              list: z.array(z.string()),
            })
            .optional(),
        })
      ),
    }),
    promotions: z
      .object({
        title: z.string(),
        steps: z.array(
          z.object({
            image: z.string(),
            caption: z.string(),
            highlight: z.array(z.string()).optional(),
          })
        ),
        footer_text: z.string().optional(),
      })
      .optional(),
    secure_payments: z
      .object({
        label: z.string(),
        icon: z.string().optional(),
        gateways: z.array(
          z.object({
            image: z.string(),
          })
        ),
      })
      .optional(),
  }),
});

const paymentSuccessPageCollection = defineCollection({
  type: "content",
  schema: z.object({
    meta_title: z.string().optional(),
    meta_description: z.string().optional(),
    payment: z.object({
      title: z.string(),
      description: z.string(),
      downloadButton: z.object({
        text: z.string(),
        href: z.string(),
        icon: z.string(),
      }),
    }),
    activation: z.object({
      title: z.string(),
      description: z.string(),
      steps: z.array(
        z.object({
          title: z.string(),
          image: z.string(),
          alt: z.string().optional(),
        }),
      ),
    }),
    tutorials: z.object({
      title: z.string(),
      description: z.string(),
      cards: z.object({
        codingInterviewCopilot: z.object({
          title: z.string(),
          description: z.string(),
          coverImage: z.string(),
          playButtonImage: z.string(),
        }),
        interviewCopilot: z.object({
          title: z.string(),
          description: z.string(),
          coverImage: z.string(),
          playButtonImage: z.string(),
        }),
        zoomDemo: z.object({
          title: z.string(),
          description: z.string(),
          coverImage: z.string(),
          playButtonImage: z.string(),
        }),
      }),
    }),
    support: z.object({
      title: z.string(),
      description: z.string(),
      discord: z.object({
        label: z.string(),
        href: z.string(),
        icon: z.string(),
      }),
      whatsapp: z.object({
        label: z.string(),
        href: z.string(),
        icon: z.string(),
      }),
      email: z.object({
        label: z.string(),
        email: z.string(),
        href: z.string(),
        icon: z.string(),
      }),
    }),
    footer: z.object({
      copyright: z.string(),
      brand: z.string(),
      brandLink: z.string(),
    }),
  }),
});

const faqaimockinterviewCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    description: z.string(),
    meta_title: z.string().optional(),
    accordion: z.object({
      enable: z.boolean(),
      items: z.array(
        z.object({
          accordion_header: z.string(),
          accordion_content: z.string(),
        }),
      ),
    }),
  }),
});

const testimonialaimockinterviewCollection = defineCollection({
  schema: z.object({
    enable: z.boolean(),
    title: z.string(),
    description: z.string(),
    testimonials: z.array(
      z.object({
        name: z.string(),
        designation: z.string(),
        avatar: z.string(),
        content: z.string(),
      }),
    ),
  }),
});

const sectionsCollection = defineCollection({
  schema: z.union([
    // FAQ schema
    z.object({
      title: z.string(),
      description: z.string(),
      meta_title: z.string().optional(),
      accordion: z.object({
        enable: z.boolean(),
        items: z.array(
          z.object({
            accordion_header: z.string(),
            accordion_content: z.string(),
          }),
        ),
      }),
    }),
    // Testimonial schema
    z.object({
      enable: z.boolean(),
      title: z.string(),
      description: z.string(),
      testimonials: z.array(
        z.object({
          name: z.string(),
          designation: z.string(),
          avatar: z.string(),
          content: z.string(),
        }),
      ),
      videoTestimonials: z
        .array(
          z.object({
            videoWebm: z.string(),
            videoMp4: z.string(),
            poster: z.string(),
            jobTitle: z.string(),
            quote: z.string(),
            ariaLabel: z.string(),
            personName: z.string().optional(),
            company: z.string().optional(),
          }),
        )
        .optional(),
    }),
    // Call to Action schema
    z.object({
      enable: z.boolean(),
      title: z.string(),
      description: z.string(),
      button: z.object({
        enable: z.boolean(),
        label: z.string(),
        link: z.string(),
      }),
    }),
    // Undetectable schema
    z.object({
      enable: z.boolean(),
      title: z.string(),
      description: z.string(),
      image: z.string().optional(),
      base_image: z.string().optional(),
      overlay_image: z.string().optional(),
      highlights: z
        .array(
          z.object({
            title: z.string(),
            description: z.string(),
            image: z.string().optional(),
          }),
        )
        .optional(),
      items: z.record(
        z.object({
          title: z.string(),
          description: z.string(),
          image: z.string().optional(),
          compact_image: z.string().optional(),
          expanded_description: z.string().optional(),
          video: z.string().optional(),
        }),
      ),
      background: z
        .array(
          z.object({
            image: z.string().optional(),
          }),
        )
        .optional(),
    }),
    // Features schema
    z.object({
      enable: z.boolean(),
      title: z.string(),
      description: z.string(),
      canonical: z.string().optional(),
      image: z.string().optional(),
      items: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          icon: z.string(),
        }),
      ),
    }),
    // Rotating logos schema
    z.object({
      enable: z.boolean(),
      center_icon: z.object({
        src: z.string(),
        alt: z.string().optional(),
      }),
      logos: z.array(
        z.object({
          name: z.string(),
          image: z.string(),
          class_name: z.string(),
        }),
      ),
    }),
    // Popular Posts schema
    z.object({
      title: z.string(),
      featured_post: z.object({
        image: z.string(),
        title: z.string(),
        description: z.string(),
        link: z.string(),
      }),
      posts: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          link: z.string(),
          image: z.string(),
        }),
      ),
    }),
    // FeaturesSectionV2 schema
    z.object({
      enable: z.boolean(),
      header: z.object({
        title_line_1: z.string(),
        title_line_2: z.string(),
        description: z.string().optional(),
      }),
      hero_card: z.object({
        title: z.string(),
        description: z.string(),
        video: z.object({
          src: z.string(),
          title: z.string(),
          min_height_px: z.number().optional(),
          cover_image: z.string().optional(),
          play_button_image: z.string().optional(),
        }),
      }),
      cards: z.object({
        pressure: z.object({
          title: z.string(),
          description: z.string(),
        }),
        personalized: z.object({
          title: z.string(),
          description: z.string(),
          input_cards: z.array(
            z.object({
              label: z.string(),
              icon: z.string(),
            }),
          ).optional(),
          resume_image: z.string().optional(),
          resume_items: z.array(
            z.object({
              text: z.string(),
              color: z.string(),
              image: z.string(),
            }),
          ),
        }),
        platform: z.object({
          title: z.string(),
          description: z.string(),
        }),
        multilingual: z.object({
          title: z.string(),
          description: z.string(),
          languages: z.array(z.string()),
        }).optional(),
        interview_types: z.object({
          title: z.string(),
          description: z.string(),
          items: z.array(
            z.object({
              label: z.string(),
              icon: z.string(),
            }),
          ).optional(),
          badges: z.array(
            z.object({
              label: z.string(),
              initial: z.string(),
              color: z.string(),
            }),
          ).optional(),
        }),
      }),
      rotating_logos: z.object({
        enable: z.boolean(),
        center_icon: z.object({
          src: z.string(),
          alt: z.string().optional(),
        }),
        logos: z.array(
          z.object({
            name: z.string(),
            image: z.string(),
            class_name: z.string(),
          }),
        ),
      }),
      voice_ui: z.object({
        bubbles: z.array(
          z.object({
            logo: z.string(),
            name: z.string(),
            class_name: z.string(),
          }),
        ),
        avatar: z.string(),
        avatar_alt: z.string(),
        bar_count: z.number(),
      }),
    }),
  ]),
});

export type PopularPostsData = {
  title: string;
  featured_post: {
    image: string;
    title: string;
    description: string;
    link: string;
  };
  posts: {
    title: string;
    description: string;
    link: string;
    image: string;
  }[];
};

export type FeaturesSectionV2Data = {
  enable: boolean;
  header: {
    title_line_1: string;
    title_line_2: string;
    description?: string;
  };
  hero_card: {
    title: string;
    description: string;
    video: {
      src: string;
      title: string;
      min_height_px?: number;
      cover_image?: string;
      play_button_image?: string;
    };
  };
  cards: {
    pressure: { title: string; description: string };
    personalized: {
      title: string;
      description: string;
      input_cards: { label: string; icon: string }[];
      resume_image?: string;
      resume_items: { text: string; color: string; image: string }[];
    };
    platform: { title: string; description: string };
    multilingual: {
      title: string;
      description: string;
      languages: string[];
    };
    interview_types: {
      title: string;
      description: string;
      items: {
        label: string;
        icon: string;
      }[];
      badges: {
        label: string;
        initial: string;
        color: string;
      }[];
    };
  };
  rotating_logos: {
    enable: boolean;
    center_icon: { src: string; alt?: string };
    logos: { name: string; image: string; class_name: string }[];
  };
  voice_ui: {
    bubbles: { logo: string; name: string; class_name: string }[];
    avatar: string;
    avatar_alt: string;
    bar_count: number;
  };
};

const aiMockInterviewPageCollection = defineCollection({
  schema: z.object({
    enable: z.boolean().optional(),
    title: z.string(),
    meta_title: z.string().optional(),
    meta_description: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    canonical: z.string().optional(),
    challenges_section: z.object({
      title: z.string(),
      description: z.string(),
      challenges: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          icon: z.string(),
        })
      ),
    }),
    explore_section: z.object({
      title: z.string(),
      description: z.string(),
      features: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          image: z.string(),
          lists: z.array(z.string()).nullable().optional(),
        })
      ),
    }),
    inbound_solution: z.object({
      title: z.string(),
      description: z.string(),
      button: z.object({
        enable: z.boolean(),
        label: z.string(),
        link: z.string(),
      }),
      solutions: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          icon: z.string(),
        })
      ),
    }),
    tools_section: z.object({
      enable: z.boolean(),
      title: z.string(),
      tools: z.array(
        z.object({
          name: z.string(),
          logo: z.string(),
        })
      ),
    }),
  }),
});

// Category collection schema
const categoryCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    slug: z.string().optional(),
    featured_image: z.string().optional(),
    image: z.string().optional(), // Add image field
    meta_title: z.string().optional(), // Add meta_title field
    category: z.array(z.string()).default([]),
    date: z.string().or(z.date()).optional(), // Accept string or Date type
    author: z.string().optional(),
    draft: z.boolean().optional(),
  }),
});

const interviewCopilotPageCollection = defineCollection({
  schema: z.object({
    enable: z.boolean().optional(),
    title: z.string(),
    meta_title: z.string().optional(),
    meta_description: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    canonical: z.string().optional(),
    banner: z.object({
      title: z.string(),
      content: z.string(),
      badge: z.string(),
      button: z.object({
        enable: z.boolean(),
        label: z.string(),
        link: z.string(),
      }),
      button2: z.object({
        enable: z.boolean(),
        label: z.string(),
        link: z.string(),
      }),
      video_button: z.object({
        enable: z.boolean(),
        label: z.string(),
        link: z.string(),
      }),
    }),
    nav_buttons: z
      .array(
        z.object({
          label: z.string(),
          link: z.string(),
        })
      )
      .optional(),
    challenges_section: z.object({
      title: z.string(),
      description: z.string(),
      challenges: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          icon: z.string(),
        })
      ),
    }),
    platform: z.object({
      title: z.string(),
      description: z.string(),
    }),
    explore_section: z.object({
      title: z.string(),
      description: z.string(),
      mastery_title: z.string().optional(),
      mastery_description: z.string().optional(),
      features: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          image: z.string(),
          lists: z.array(z.string()),
        })
      ),
    }),
    inbound_solution: z.object({
      title: z.string(),
      description: z.string(),
      button: z.object({
        enable: z.boolean(),
        label: z.string(),
        link: z.string(),
      }),
      solutions: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          icon: z.string(),
        })
      ),
    }),
    tools_section: z.object({
      enable: z.boolean(),
      title: z.string(),
      tools: z.array(
        z.object({
          name: z.string(),
          logo: z.string(),
        })
      ),
    }),
  }),
});

const downloadsPageCollection = defineCollection({
  schema: z.object({
    enable: z.boolean().optional(),
    title: z.string(),
    description: z.string().optional(),
    meta_title: z.string().optional(),
    meta_description: z.string().optional(),
    last_updated: z.string().optional(),
    current_version: z.string().optional(),
    canonical: z.string().optional(),
    image: z.string().optional(),
    size_label: z.string().optional(),
    download_icon: z.string().optional(),
    check_icon: z.string().optional(),
    system_requirements: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
        })
      )
      .optional(),
    windows_guide: z
      .object({
        title: z.string(),
        tip_label: z.string(),
        tip_question: z.string(),
        tip_assurance: z.string(),
        tip_reason: z.string(),
        tip_action: z.string(),
        image: z.string(),
        image_alt: z.string(),
        video_url: z.string(),
        video_title: z.string(),
      })
      .optional(),
    items: z.array(
      z.object({
        image: z.string(),
        name: z.string(),
        description: z.string(),
        file_size: z.string(),
        url: z.string(),
        button_text: z.string().optional(),
        download_notice: z.string().optional(),
        linux_packages: z
          .array(
            z.object({
              file_size: z.string().optional(),
              url: z.string().optional(),
              button_text: z.string().optional(),
            })
          )
          .optional(),
        video_url: z.string().optional(),
        tips: z.string().optional(),
        tips2: z.string().optional(),
        teminal: z.string().optional(),
      })
    ),
  }),
});

const lynccontainerPageCollection = downloadsPageCollection;

const paymentsPageCollection = defineCollection({
  schema: z.object({
    canonical: z.string().optional(),
    meta_title: z.string(),
    meta_description: z.string(),
    title: z.string(),
    description: z.string(),
    payment_methods: z.object({
      monthly: z.array(
        z.object({
          payment_company: z.string(),
          payment_name: z.string(),
          payment_logo: z.string(),
          payment_description: z.string(),
          payment_link: z.string(),
          is_active: z.boolean(),
          is_visible: z.boolean(),
          display_order: z.number(),
        })
      ),
      quarterly: z.array(
        z.object({
          payment_company: z.string(),
          payment_name: z.string(),
          payment_logo: z.string(),
          payment_description: z.string(),
          payment_link: z.string(),
          is_active: z.boolean(),
          is_visible: z.boolean(),
          display_order: z.number(),
        })
      ),
      annually: z.array(
        z.object({
          payment_company: z.string(),
          payment_name: z.string(),
          payment_logo: z.string(),
          payment_description: z.string(),
          payment_link: z.string(),
          is_active: z.boolean(),
          is_visible: z.boolean(),
          display_order: z.number(),
        })
      ),
    }),
    payment_types: z.object({
      monthly: z.object({
        label: z.string(),
        description: z.string(),
      }),
      quarterly: z.object({
        label: z.string(),
        description: z.string(),
      }),
      annually: z.object({
        label: z.string(),
        description: z.string(),
      }),
    }),
  }),
});

const getlisencePageCollection = defineCollection({
  schema: z.object({
    enable: z.boolean().optional(),
    title: z.string(),
    description: z.string().optional(),
    meta_title: z.string().optional(),
    meta_description: z.string().optional(),
    last_updated: z.string().optional(),
    current_version: z.string().optional(),
    canonical: z.string().optional(),
    image: z.string().optional(),
    items: z.array(
      z.object({
        image: z.string(),
        name: z.string(),
        description: z.string(),
        file_size: z.string(),
        url: z.string(),
      })
    ),
  }),
});

const codingInterviewCopilotPageCollection = defineCollection({
  schema: z.object({
    enable: z.boolean().optional(),
    title: z.string(),
    meta_title: z.string().optional(),
    meta_description: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    canonical: z.string().optional(),
    challenges_section: z.object({
      title: z.string(),
      description: z.string(),
      challenges: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          icon: z.string(),
        })
      ),
    }),
    explore_section: z.object({
      title: z.string(),
      description: z.string(),
      mastery_title: z.string().optional(),
      mastery_description: z.string().optional(),
      features: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          image: z.string(),
          lists: z.array(z.string()),
        })
      ),
    }),
    inbound_solution: z.object({
      title: z.string(),
      description: z.string(),
      button: z.object({
        enable: z.boolean(),
        label: z.string(),
        link: z.string(),
      }),
      solutions: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          icon: z.string(),
        })
      ),
    }),
    tools_section: z.object({
      enable: z.boolean(),
      title: z.string(),
      tools: z.array(
        z.object({
          name: z.string(),
          logo: z.string(),
        })
      ),
    }),
  }),
});

const contactCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    meta_title: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    draft: z.boolean().optional(),
    form: z.object({
      name_label: z.string(),
      name_placeholder: z.string(),
      email_label: z.string(),
      email_placeholder: z.string(),
      message_label: z.string(),
      message_placeholder: z.string(),
      submit_label: z.string(),
      sending_text: z.string(),
      error_required: z.string(),
      error_email: z.string(),
      error_submission: z.string(),
      error_system: z.string(),
      success_message: z.string(),
    }).optional(),
    info: z.object({
      title: z.string(),
      description: z.string(),
      phone_label: z.string(),
      email_label: z.string(),
      address_label: z.string(),
    }).optional(),
    cards: z.object({
      sales: z.object({
        title: z.string(),
        description: z.string(),
      }).optional(),
      support: z.object({
        title: z.string(),
        description: z.string(),
      }).optional(),
      resources: z.object({
        title: z.string(),
        description: z.string(),
      }).optional(),
    }).optional(),
  }),
});

const updatesPageCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    meta_title: z.string().optional(),
    description: z.string().optional(),
    draft: z.boolean().optional(),
    updates: z.array(
      z.object({
        date: z.string(),
        title: z.string(),
        tag: z.string(),
        description: z.string(),
      }),
    ),
  }),
});

// Export collections
export const collections = {
  pages: pagesCollection,
  cart: cartPageCollection,
  features: featuresPageCollection,
  pricing: pricingPageCollection,
  _pricing: legacyPricingPageCollection,
  "ai-mock-interview": aiMockInterviewPageCollection,
  "interview-copilot": interviewCopilotPageCollection,
  "coding-interview-copilot": codingInterviewCopilotPageCollection,
  downloads: downloadsPageCollection,
  lynccontainer: lynccontainerPageCollection,
  sections: sectionsCollection,
  payments: paymentsPageCollection,
  "payment-success": paymentSuccessPageCollection,
  updates: updatesPageCollection,
};
