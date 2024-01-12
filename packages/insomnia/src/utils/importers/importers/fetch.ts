import { Converter, Header, Parameter } from '../entities';

export const id = 'fetch';
export const name = 'Fetch';
export const description = 'Fetch code (from Chrome)';

export const convert: Converter = rawData => {
  const match = rawData.match(/^fetch\("(.+?)", ({.+?^})\);/ms);

  if (!match) {
    return null;
  }

  let parameters: Parameter[] = [];
  let url: string = '';

  try {
    const { searchParams, href, search } = new URL(match[1]);
    parameters = Array.from(searchParams.entries()).map(([name, value]) => ({
      name,
      value,
      disabled: false,
    }));

    url = href.replace(search, '').replace(/\/$/, '');
  } catch (error) {}

  const params = JSON.parse(match[2]);
  const allHeaders = Object.entries(params.headers).map(([name, value]) => ({ name, value }));
  const body = params.body;
  const method = params.method;

  const { headers, authentication } = importAuthentication(allHeaders);

  return [
    {
      _id: '__REQ__',
      _type: 'request',
      parentId: '__WORKSPACE_ID__',
      name: url || 'Fetch Import',
      body,
      headers,
      method,
      parameters,
      authentication,
      url,
    },
  ];
};

function importAuthentication(headers: Header[]) {
  const authorizationHeader = headers.find(({ name }) => name === 'authorization');

  if (!authorizationHeader) {
    return { authentication: {}, headers };
  }

  headers = headers.filter(h => h !== authorizationHeader);
  const headerValue = authorizationHeader.value;

  switch (headerValue?.substring(0, headerValue.indexOf(' '))) {
    case 'Bearer': // will work for OAuth2 as well
      return {
        authentication: importBearerAuthenticationFromHeader(headerValue),
        headers: headers,
      };

    case 'Basic':
      return {
        authentication: importBasicAuthenticationFromHeader(headerValue),
        headers,
      };

    default:
      return { authentication: {}, headers };
  }
}

function importBasicAuthenticationFromHeader(authHeader: string) {
  if (!authHeader) {
    return {};
  }

  const authStringIndex = authHeader.trim().replace(/\s+/g, ' ').indexOf(' ');
  const hasEncodedAuthString = authStringIndex !== -1;
  const encodedAuthString = hasEncodedAuthString ? authHeader.substring(authStringIndex + 1) : '';
  const authString = Buffer.from(encodedAuthString, 'base64').toString();
  const item = {
    type: 'basic',
    disabled: false,
    username: RegExp(/.+?(?=\:)/).exec(authString)?.[0],
    password: RegExp(/(?<=\:).*/).exec(authString)?.[0],
  };

  return item;
}

function importBearerAuthenticationFromHeader(authHeader: string) {
  if (!authHeader) {
    return {};
  }
  const authHeader2 = authHeader.replace(/\s+/, ' ');
  const tokenIndex = authHeader.indexOf(' ');
  return {
    type: 'bearer',
    disabled: false,
    token: tokenIndex + 1 ? authHeader2.substring(tokenIndex + 1) : '',
    prefix: '',
  };
}
