import Dysmsapi20170525, * as Dysmsapi from "@alicloud/dysmsapi20170525";
import * as OpenApi from "@alicloud/openapi-client";
import * as TeaUtil from "@alicloud/tea-util";

type AliyunErrorShape = {
  code?: unknown;
  requestId?: unknown;
  data?: Record<string, unknown>;
};

export class AliyunSmsError extends Error {
  readonly requestId: string | null;
  readonly errorCode: string;

  constructor(errorCode: string, requestId: string | null) {
    super("Aliyun SMS request failed");
    this.name = "AliyunSmsError";
    this.errorCode = errorCode;
    this.requestId = requestId;
  }
}

function requiredSetting(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new AliyunSmsError("SMS_CONFIGURATION_MISSING", null);
  return value;
}

export function isAliyunSmsConfigured() {
  return [
    "ALIYUN_SMS_ACCESS_KEY_ID",
    "ALIYUN_SMS_ACCESS_KEY_SECRET",
    "ALIYUN_SMS_SIGN_NAME",
    "ALIYUN_SMS_TEMPLATE_CODE",
    "ALIYUN_SMS_TEMPLATE_PARAM_NAME",
  ].every((name) => Boolean(process.env[name]?.trim()));
}

function getErrorMetadata(error: unknown) {
  const shaped = (error && typeof error === "object" ? error : {}) as AliyunErrorShape;
  const data = shaped.data ?? {};
  const errorCode = data.Code ?? data.code ?? shaped.code;
  const requestId = data.RequestId ?? data.requestId ?? shaped.requestId;
  return {
    errorCode: typeof errorCode === "string" && errorCode ? errorCode : "ALIYUN_SDK_ERROR",
    requestId: typeof requestId === "string" && requestId ? requestId : null,
  };
}

/** Sends a single verification code using Alibaba Cloud's official Dysmsapi SDK. */
export async function sendVerificationCode(phone: string, code: string): Promise<{ requestId: string | null }> {
  if (!/^1[3-9]\d{9}$/.test(phone)) throw new AliyunSmsError("INVALID_PHONE", null);
  if (!/^\d{6}$/.test(code)) throw new AliyunSmsError("INVALID_CODE", null);

  const accessKeyId = requiredSetting("ALIYUN_SMS_ACCESS_KEY_ID");
  const accessKeySecret = requiredSetting("ALIYUN_SMS_ACCESS_KEY_SECRET");
  const signName = requiredSetting("ALIYUN_SMS_SIGN_NAME");
  const templateCode = requiredSetting("ALIYUN_SMS_TEMPLATE_CODE");
  const templateParamName = requiredSetting("ALIYUN_SMS_TEMPLATE_PARAM_NAME");

  const config = new OpenApi.Config({ accessKeyId, accessKeySecret });
  config.endpoint = "dysmsapi.aliyuncs.com";

  // The generated SDK exposes the class as the default export in Node ESM,
  // while some bundlers unwrap it automatically. Support both interop shapes.
  const SmsClient = ((Dysmsapi20170525 as unknown as { default?: typeof Dysmsapi20170525 }).default ?? Dysmsapi20170525);
  const client = new SmsClient(config);
  const request = new Dysmsapi.SendSmsRequest({
    phoneNumbers: phone,
    signName,
    templateCode,
    templateParam: JSON.stringify({ [templateParamName]: code }),
  });

  try {
    const response = await client.sendSmsWithOptions(request, new TeaUtil.RuntimeOptions({ readTimeout: 10000 }));
    const body = response.body;
    const requestId = typeof body?.requestId === "string" ? body.requestId : null;
    if (body?.code !== "OK") {
      const errorCode = typeof body?.code === "string" ? body.code : "ALIYUN_SMS_REJECTED";
      throw new AliyunSmsError(errorCode, requestId);
    }
    return { requestId };
  } catch (error) {
    if (error instanceof AliyunSmsError) throw error;
    const metadata = getErrorMetadata(error);
    throw new AliyunSmsError(metadata.errorCode, metadata.requestId);
  }
}
