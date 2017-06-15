# NodeRED authenticated through w3id

This repository deploys a NodeRED instance which is authenticated via w3id (and therefore will work only inside the IBM firewall).

## To deploy:


[![Deploy to Bluemix](https://bluemix.net/deploy/button.png)](https://bluemix.net/deploy?repository=https://github.ibm.com/rapid-prototyping/node-red-w3id)

1. Decide on app name and route on Bluemix
2. Register Bluemix route at https://w3.innovate.ibm.com/tools/sso/home.html as an OpenIDConnect service
3. For the call back URL, register as `<Bluemix route>/auth/callback`
4. To test, use of the w3id Staging service is recommended, this uses the live directory but not the live OpenIDConnect service
5. Download the certificate supplied as `oidc_w3id.cer` and upload to main directory of repo
6. Update `oid-settings.js` with the configuration settings supplied by the sso registration service
7. Deploy repo

Note that as standard, the `/red` route for the editor is authenticated, but the routes for the `http in` nodes are not (which means the dashboard is not authenticated). Authentication of `http in` nodes can be done within the NodeRED editor if required, or can be hardcoded by following the instructions in the comments in `app.js`

## Useful subflows:

### w3id login subflow

This subflow should be placed directly after an `http in` node and it validates whether the user is logged in. If not it redirects to the login page and then returns to the same path once logged in.

```
[{"id":"5b7ea8bf.70a15","type":"subflow","name":"w3id login","info":"This node checks to see if the user is logged in.\nIf not, it stores the original URL and redirects\nto /login. On a successful return, it resumes at\nthe stored URL","in":[{"x":52.5,"y":48,"wires":[{"id":"a6b19b7c.903648"}]}],"out":[{"x":399,"y":122,"wires":[{"id":"a6b19b7c.903648","port":1}]}]},{"id":"a6b19b7c.903648","type":"switch","z":"5b7ea8bf.70a15","name":"User null?","property":"req.user","propertyType":"msg","rules":[{"t":"null"},{"t":"else"}],"checkall":"true","outputs":2,"x":171.5,"y":48,"wires":[["d836655d.df5988"],[]]},{"id":"d836655d.df5988","type":"change","z":"5b7ea8bf.70a15","name":"Redirect to login","rules":[{"t":"set","p":"req.session.originalUrl","pt":"msg","to":"req.originalUrl","tot":"msg"},{"t":"set","p":"statusCode","pt":"msg","to":"307","tot":"num"},{"t":"set","p":"headers.location","pt":"msg","to":"/login","tot":"str"}],"action":"","property":"","from":"","to":"","reg":false,"x":392,"y":42,"wires":[["9acba24b.369168"]]},{"id":"9acba24b.369168","type":"http response","z":"5b7ea8bf.70a15","name":"","x":581.5,"y":42.75,"wires":[]}]
```
