export function protectedPage({ authenticate, workspace }) {
  return async (request, response, next) => {
    response.set('Cache-Control', 'private, no-store');
    response.set('Vary', 'Cookie, Authorization');
    try {
      const user=await authenticate(request,response);
      if(!user)return response.redirect(303,'/login');
      request.user=user;
      request.workspace=await workspace(user.id);
      next();
    }catch(error){
      const status=error.statusCode===403?403:503;
      response.status(status).type('text/plain').send(status===403?'Your account does not have an active CRM workspace. Contact your administrator.':'Sign-in verification is temporarily unavailable. Please try again.');
    }
  };
}
