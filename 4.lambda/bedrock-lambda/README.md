# bedrock-lambda

Python 3.11 Lambda that role-plays a debate persona using AWS Bedrock Nova Lite.

## Files
- `lambda_function.py` — handler
- `prompts.py` — prompt builder (mirrors gemini-lambda/prompts.js)

## Deploy

1. Zip the function:
   ```bash
   cd 4.lambda/bedrock-lambda
   zip -j function.zip lambda_function.py prompts.py
   ```
2. Create Lambda (Python 3.11) and upload `function.zip`.
3. Attach IAM role with policy `AmazonBedrockFullAccess` (or scoped `bedrock:InvokeModel` on `amazon.nova-lite-v1:0`).
4. Set env var `BEDROCK_MODEL_ID=amazon.nova-lite-v1:0` (region inherits Lambda region).
5. Enable Function URL (Auth: NONE for dev, IAM for prod).
6. In Bedrock console > Model access > enable "Amazon Nova Lite" in the same region as the Lambda.
