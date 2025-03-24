1. Add a `.env` file with the following info:
   (You can generate the info in your AWS access portal URL.)

   ```
   AWS_ACCESS_KEY_ID="put_key_id_here"
   AWS_SECRET_ACCESS_KEY="put_secret_access_key_here"
   AWS_SESSION_TOKEN="put_session_token_here"
   REGION="us-east-2"
   ```
2. `npm install`

2. `npm run build`

3. Choose which version you want to test:

   1. SDK only: `node ./src/sdk-create-s3.js`
   2. CDK + SDK: `node ./src/main.js`