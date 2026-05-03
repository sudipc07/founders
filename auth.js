async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function login(password) {
  const hash = await hashPassword(password)
  if (hash === CONFIG.ADMIN_PASSWORD_HASH) {
    sessionStorage.setItem('role', 'admin')
    window.location.href = '/chapters.html'
  } else if (hash === CONFIG.REVIEWER_PASSWORD_HASH) {
    sessionStorage.setItem('role', 'reviewer')
    window.location.href = '/chapters.html'
  } else {
    return false
  }
  return true
}

function requireAuth() {
  const role = sessionStorage.getItem('role')
  if (!role) window.location.href = '/index.html'
  return role
}

function requireAdmin() {
  const role = requireAuth()
  if (role !== 'admin') window.location.href = '/chapters.html'
  return role
}

function logout() {
  sessionStorage.clear()
  window.location.href = '/index.html'
}
