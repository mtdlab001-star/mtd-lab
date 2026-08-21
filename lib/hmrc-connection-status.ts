export type HmrcConnectionRow = {
  access_token?: string | null
  refresh_token?: string | null
  token_expires_at?: string | null
  connected_at?: string | null
  scope?: string | null
}

export type HmrcConnectionStatus = {
  connected: boolean
  refreshable: boolean
  expired: boolean
  expiresSoon: boolean
  usable: boolean
  label: string
  detail: string
  badgeClass: string
}

export function assessHmrcConnection(connection?: HmrcConnectionRow | null, now = Date.now()): HmrcConnectionStatus {
  const hasAccessToken = Boolean(connection?.access_token)
  const hasRefreshToken = Boolean(connection?.refresh_token)
  const expiresAt = connection?.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0
  const hasExpiry = Number.isFinite(expiresAt) && expiresAt > 0
  const expired = hasExpiry && expiresAt <= now
  const expiresSoon = hasExpiry && expiresAt > now && expiresAt <= now + 15 * 60 * 1000
  const connected = hasAccessToken && hasRefreshToken
  const refreshable = connected && hasRefreshToken
  const usable = connected && (!expired || refreshable)

  if (!hasAccessToken) {
    return {
      connected: false,
      refreshable: false,
      expired: false,
      expiresSoon: false,
      usable: false,
      label: 'HMRC Not Connected',
      detail: 'Reconnect this taxpayer to HMRC before synchronising or submitting.',
      badgeClass: 'badge badgeMuted',
    }
  }

  if (expired && !hasRefreshToken) {
    return {
      connected: true,
      refreshable: false,
      expired: true,
      expiresSoon: false,
      usable: false,
      label: 'Reconnect Required',
      detail: 'The HMRC access token has expired and no refresh token is available.',
      badgeClass: 'badge badgeMuted',
    }
  }

  if (expired) {
    return {
      connected: true,
      refreshable: true,
      expired: true,
      expiresSoon: false,
      usable: true,
      label: 'HMRC Refresh Ready',
      detail: 'The HMRC access token has expired, but the refresh token is available for the next HMRC call.',
      badgeClass: 'badge',
    }
  }

  if (expiresSoon) {
    return {
      connected: true,
      refreshable: true,
      expired: false,
      expiresSoon: true,
      usable: true,
      label: 'HMRC Token Expiring',
      detail: 'The HMRC access token is close to expiry and will refresh automatically on the next HMRC call.',
      badgeClass: 'badge',
    }
  }

  return {
    connected: true,
    refreshable: true,
    expired: false,
    expiresSoon: false,
    usable: true,
    label: 'HMRC Connected',
    detail: hasExpiry ? 'HMRC authorisation is active.' : 'HMRC authorisation is stored and can be refreshed when required.',
    badgeClass: 'badge',
  }
}
