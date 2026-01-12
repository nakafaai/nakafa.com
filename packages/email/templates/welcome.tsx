import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { Button } from "@repo/email/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/email/components/card";
import { WrapperIcon } from "@repo/email/components/wrapper";
import { Tailwind } from "@repo/email/tailwind";

interface WelcomeProps {
  readonly name: string;
}

export const Welcome = ({ name }: WelcomeProps) => {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-background font-sans text-foreground antialiased">
          <Preview>Welcome to Nakafa - Your journey begins here</Preview>
          <Container className="mx-auto my-8 max-w-md p-5">
            <Section className="mt-6">
              <Img
                alt="Nakafa"
                className="mx-auto"
                height="64"
                src="https://nakafa.com/logo.png"
                width="64"
              />
            </Section>

            <Section className="mt-6 text-center">
              <Text className="m-0 font-semibold text-2xl text-foreground tracking-tight">
                You're in! Welcome to Nakafa 🚀
              </Text>
              <Text className="mt-2 text-muted-foreground text-sm">
                Let's make learning something you actually enjoy.
              </Text>
            </Section>

            <Section className="mt-6">
              <Text className="text-base text-foreground leading-6">
                Hi {name},
              </Text>
              <Text className="mt-4 text-base text-foreground leading-6">
                So glad you're here. We built Nakafa because we believe
                high-quality education should be accessible (and fun) for
                everyone.
              </Text>
              <Text className="mt-4 text-base text-foreground leading-6">
                Whether you're prepping for exams or just curious about how the
                world works, you've got this.
              </Text>
            </Section>

            <Card
              className="mt-6 w-full border-border bg-muted/30"
              style={{ width: "100%" }}
            >
              <CardHeader
                className="w-full border-border/50"
                style={{ width: "100%" }}
              >
                <CardTitle className="text-lg">Where to start?</CardTitle>
              </CardHeader>
              <CardContent className="w-full" style={{ width: "100%" }}>
                <Section>
                  <Row className="mb-4">
                    <Column className="w-8 pr-3 align-top">
                      <WrapperIcon>
                        <Text className="m-0 text-center text-lg leading-8">
                          📚
                        </Text>
                      </WrapperIcon>
                    </Column>
                    <Column className="align-top">
                      <Text className="m-0 font-medium text-sm">
                        Dive into Subjects
                      </Text>
                      <Text className="m-0 text-muted-foreground text-xs">
                        Find a topic that sparks your interest.
                      </Text>
                    </Column>
                  </Row>
                  <Row className="mb-4">
                    <Column className="w-8 pr-3 align-top">
                      <WrapperIcon>
                        <Text className="m-0 text-center text-lg leading-8">
                          ✍️
                        </Text>
                      </WrapperIcon>
                    </Column>
                    <Column className="align-top">
                      <Text className="m-0 font-medium text-sm">
                        Test Your Knowledge
                      </Text>
                      <Text className="m-0 text-muted-foreground text-xs">
                        Practice with interactive exercises.
                      </Text>
                    </Column>
                  </Row>
                  <Row>
                    <Column className="w-8 pr-3 align-top">
                      <WrapperIcon>
                        <Text className="m-0 text-center text-lg leading-8">
                          🤝
                        </Text>
                      </WrapperIcon>
                    </Column>
                    <Column className="align-top">
                      <Text className="m-0 font-medium text-sm">
                        Meet the Community
                      </Text>
                      <Text className="m-0 text-muted-foreground text-xs">
                        Learn alongside others.
                      </Text>
                    </Column>
                  </Row>
                </Section>
              </CardContent>
            </Card>

            <Section className="mt-6 text-center">
              <Button href="https://nakafa.com/en" size="lg">
                Start Learning
              </Button>
            </Section>

            <Section className="mt-6">
              <Text className="mt-4 text-base text-foreground leading-6">
                Cheers,
                <br />
                The Nakafa Team
              </Text>
            </Section>

            <Hr className="mx-0 my-6 w-full border border-border" />

            <Section className="text-center">
              <Text className="m-0 text-muted-foreground text-xs leading-relaxed">
                © {new Date().getFullYear()} PT. Nakafa Tekno Kreatif. All
                rights reserved.
              </Text>
              <Text className="m-0 mt-1 text-muted-foreground text-xs leading-relaxed">
                Taman Sukahati Permai H6, Kab. Bogor
              </Text>
              <Section align="center" className="mt-4 w-auto">
                <Row>
                  <Column className="pr-2">
                    <Link
                      className="text-muted-foreground text-xs"
                      href="https://nakafa.com/en/privacy-policy"
                      style={{ textDecoration: "underline" }}
                    >
                      Privacy Policy
                    </Link>
                  </Column>
                  <Column className="pl-2">
                    <Link
                      className="text-muted-foreground text-xs"
                      href="https://nakafa.com/en/terms-of-service"
                      style={{ textDecoration: "underline" }}
                    >
                      Terms of Service
                    </Link>
                  </Column>
                </Row>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

Welcome.PreviewProps = {
  name: "Nabil Fatih",
};

export default Welcome;
