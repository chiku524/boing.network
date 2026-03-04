/**
 * Testnet portal session (localStorage). Load on portal pages via <script src="/portal-session.js">.
 * Usage: BoingPortalSession.getSession() | .setSession(accountIdHex, role) | .clearSession()
 */
(function () {
  var key = 'boing_portal_session';
  function getSession() {
    try {
      var s = localStorage.getItem(key);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }
  function setSession(accountIdHex, role) {
    try {
      localStorage.setItem(key, JSON.stringify({ account_id_hex: accountIdHex, role: role }));
      return true;
    } catch (e) {
      return false;
    }
  }
  function clearSession() {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }
  function shortAccount(hex) {
    if (!hex || hex.length < 14) return hex || '';
    return hex.slice(0, 8) + '…' + hex.slice(-6);
  }
  window.BoingPortalSession = {
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    shortAccount: shortAccount,
    roleAppPath: function (role) {
      if (role === 'developer') return '/testnet/developers';
      if (role === 'user') return '/testnet/users';
      if (role === 'node_operator') return '/testnet/operators';
      return '/testnet';
    }
  };
})();
