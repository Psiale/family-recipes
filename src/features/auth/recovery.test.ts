import { readAuthCallback } from './recovery';

const redirect = 'familyrecipes:///sign-in';
it.each([
  'familyrecipes:///sign-in?code=valid',
  'familyrecipes://sign-in?code=valid',
])('accepts the registered mobile callback %s', (url) => {
  expect(readAuthCallback(url, redirect)).toEqual({ code: 'valid' });
});
it.each([
  'https://evil.example/sign-in?code=wrong',
  'familyrecipes:///other?code=wrong',
  'familyrecipes:///sign-in?code=a&code=b',
  'not-a-url',
])('ignores unrelated or ambiguous callbacks %s', (url) => {
  expect(readAuthCallback(url, redirect)).toBeNull();
});
it('recognizes expired-link errors in both query and fragment without returning their details', () => {
  expect(
    readAuthCallback(
      `${redirect}#error=access_denied&error_description=expired`,
      redirect,
    ),
  ).toEqual({ error: true });
  expect(readAuthCallback(`${redirect}?error=access_denied`, redirect)).toEqual(
    { error: true },
  );
});
