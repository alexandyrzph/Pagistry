export const endpoints = {
  cart: {
    root: "/api/cart",
    items: "/api/cart/items",
    item: (id: string) => `/api/cart/items/${id}`,
  },
  checkout: { create: "/api/checkout" },
  store: {
    root: "/api/store",
    connect: "/api/store/connect",
  },
  activity: "/api/activity",
  ai: "/api/ai",
  upload: "/api/upload",
  site: "/api/site",
  assets: (opts?: { kind?: "image" }) =>
    opts?.kind === "image" ? "/api/assets?kind=image" : "/api/assets",
  auth: {
    mode: (mode: string) => `/api/auth/${mode}`,
    providers: "/api/auth/providers",
    logout: "/api/auth/logout",
    onboard: "/api/auth/onboard",
    oauth: (provider: string) => `/api/auth/oauth/${provider}`,
    oauthCallback: (provider: string) => `/api/auth/oauth/${provider}/callback`,
  },
  account: {
    root: "/api/account",
    password: "/api/account/password",
  },
  invites: {
    byToken: (token: string) => `/api/invites/${token}`,
  },
  pages: {
    list: "/api/pages",
    byId: (id: string) => `/api/pages/${id}`,
    thumbnail: (id: string) => `/api/pages/${id}/thumbnail`,
    publish: (id: string) => `/api/pages/${id}/publish`,
    versions: (id: string) => `/api/pages/${id}/versions`,
    version: (id: string, versionId: string) => `/api/pages/${id}/versions/${versionId}`,
  },
  components: {
    list: "/api/components",
    byId: (id: string) => `/api/components/${id}`,
  },
  collections: {
    list: "/api/collections",
    byId: (id: string) => `/api/collections/${id}`,
    items: (id: string) => `/api/collections/${id}/items`,
    item: (id: string, itemId: string) => `/api/collections/${id}/items/${itemId}`,
  },
  submissions: {
    create: "/api/submissions",
    byPage: (pageId: string) => `/api/submissions?pageId=${pageId}`,
  },
  sites: {
    list: "/api/sites",
    byId: (id: string) => `/api/sites/${id}`,
    switch: "/api/sites/switch",
    home: (id: string) => `/api/sites/${id}/home`,
  },
  products: {
    list: "/api/products",
    byId: (id: string) => `/api/products/${id}`,
  },
  domains: {
    list: "/api/domains",
    byId: (id: string) => `/api/domains/${id}`,
    verify: (id: string) => `/api/domains/${id}/verify`,
    check: (host: string) => `/api/domains/check?domain=${encodeURIComponent(host)}`,
  },
  workspaces: {
    list: "/api/workspaces",
    switch: "/api/workspaces/switch",
    byId: (id: string) => `/api/workspaces/${id}`,
    members: {
      list: "/api/workspaces/members",
      byMembershipId: (membershipId: string) =>
        `/api/workspaces/members?membershipId=${membershipId}`,
    },
    invites: {
      list: "/api/workspaces/invites",
      byId: (id: string) => `/api/workspaces/invites?id=${id}`,
    },
  },
};

export const externalApi = {
  anthropic: {
    messages: "https://api.anthropic.com/v1/messages",
  },
  openai: {
    chatCompletions: "https://api.openai.com/v1/chat/completions",
  },
  oauth: {
    google: {
      authorize: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token",
      userInfo: "https://openidconnect.googleapis.com/v1/userinfo",
    },
    github: {
      authorize: "https://github.com/login/oauth/authorize",
      token: "https://github.com/login/oauth/access_token",
      user: "https://api.github.com/user",
      emails: "https://api.github.com/user/emails",
    },
  },
};
