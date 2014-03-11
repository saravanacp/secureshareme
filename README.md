## What is it for?
Everybody shares usernames, passwords, account numbers and sensitive data with friends and family. This data can be compromised during transmission, or when stored in the sender or recipient mailbox. Sharing cannot be avoided, but can be made secure. [www.secureshareme.com](www.secureshareme.com) does it for you!

## How it works?
1. The sender enters the message and clicks the secure button. A 43 character random key is generated and is used to encrypt the message using AES-256, we use [sjcl](http://crypto.stanford.edu/sjcl/) js lib. The encrypted data is then sent to the server
2. A 8 character alphanumeric random ID and a 6 digit PIN is generated in the server. The ID and the encrypted data are stored in Amazon S3. The ID and PIN are stored in DynamoDB. The server sends the ID and PIN to the client.
3. A URL is created with the ID and Key as anchor tag. The URL and PIN are shared separately using either Email or SMS. Browsers don’t send anchor tags to servers so the key is safe with the user.
4.  The receiver clicks on the URL and enters the PIN. The Key and the ID are retrieved from the anchor tag in the URL. The ID and PIN are sent to the server.
5. The Server verifies the ID and PIN and then sends encrypted data to the browser.
6. The key is then used to decrypt the encrypted message and the message is displayed.

## How is it Secure?
1. Data shared is encrypted with AES 256 bit encryption. 
2. There is no existing technology that can decrypt it without the key.
3. Key used for encryption/decryption and the encrypted data are sent using different channels.  
4. A PIN is used for secondary validation.
5. The message is deleted after a specified time.
6. We cannot see your data. We only store your encrypted data and only you have the key to it.

## Types of attacks prevented
### Email account compromise
If the sender's or receiver's email account gets compromised. Only the URL would be compromised, the message cannot be viewed without the PIN (Brute force attack of PIN is prevented as only 5 incorrect PIN entries are allowed). 
### Server or Database compromise
The hacker would get only the encrypted message. The key is with the user so decryption is not possible.

## How to deploy it?
1. Set the required environment variables:  
Twilio settings for SMS option (set to "NA" if you don't use it): TWILLO_ACCOUNT_SID, TWILLO_AUTH_TOKEN, TWILLO_PHONE_NUMBER  
AWS Settings: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SMS_COUNTER_TABLE_NAME, ID_PIN_TABLE_NAME, S3_BUCKET_NAME, AWS_REGION  
Required for security, some random string: COOKIE_SIGNATURE  
2. Deploy like a typical node application.  
	npm install  
    node app.js  
