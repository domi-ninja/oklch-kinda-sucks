import { useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { NotificationEmailDialog } from "./NotificationEmailDialog";
import { MemberRemovalDialog } from "./MemberRemovalDialog";

export default function App() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  const [name, setName] = useState("Website refresh");
  const [projectName, setProjectName] = useState(name);
  const [nameError, setNameError] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("jamie@example.com");
  const [notifications, setNotifications] = useState(true);
  const [removed, setRemoved] = useState(false);
  const [status, setStatus] = useState("All changes saved");
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    const url = new URL(location.href);
    url.searchParams.set("theme", next ? "dark" : "light");
    history.replaceState(null, "", url);
  };
  return (
    <main className="min-h-screen bg-background p-6 font-sans text-sm text-foreground">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-6">
        <h1 className="font-semibold">Studio / projects</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant="secondary"
            className="rounded-full px-3 py-2 text-sm font-normal"
          >
            Personal workspace
          </Badge>
          <Button variant="outline" className="min-h-11" onClick={toggleTheme}>
            {dark ? "Light mode" : "Dark mode"}
          </Button>
        </div>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        <Card aria-labelledby="project-heading">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle id="project-heading" role="heading" aria-level={2}>
              {projectName}
            </CardTitle>
            <span className="text-muted-foreground">01</span>
          </CardHeader>
          <CardContent>
            <Progress
              aria-label="Project progress"
              value={67}
              className="mb-6"
            />
            <div className="flex flex-wrap gap-3">
              <Button
                className="h-auto min-h-11 rounded-lg px-4 py-3"
                onClick={() => setStatus("Project opened")}
              >
                Open project
              </Button>
              <Button
                variant="outline"
                className="h-auto min-h-11 rounded-lg px-4 py-3"
                onClick={() => setStatus("Project archived")}
              >
                Archive
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card aria-labelledby="activity-heading">
          <CardHeader>
            <CardTitle id="activity-heading" role="heading" aria-level={2}>
              Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-accent text-accent-foreground">
                  JD
                </AvatarFallback>
              </Avatar>
              <div>
                Jamie updated the palette
                <div className="mt-2 text-muted-foreground">Just now</div>
              </div>
            </div>
            <div
              className="mt-6 rounded-lg bg-muted p-3 text-muted-foreground"
              role="status"
            >
              {status}
            </div>
          </CardContent>
        </Card>
        <Card aria-labelledby="settings-heading">
          <CardHeader>
            <CardTitle id="settings-heading" role="heading" aria-level={2}>
              Project settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (!name.trim()) {
                  setNameError(true);
                  nameInput.current?.focus();
                  return;
                }
                setNameError(false);
                setName(name.trim());
                setProjectName(name.trim());
                setStatus("Settings saved");
              }}
            >
              <Label htmlFor="project-name" className="mb-3 block">
                Name
              </Label>
              <Input
                ref={nameInput}
                id="project-name"
                name="project-name"
                required
                aria-invalid={nameError}
                aria-describedby={nameError ? "project-name-error" : undefined}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (nameError) setNameError(!event.target.value.trim());
                }}
                className="h-auto rounded-lg bg-background p-3 text-base md:text-base aria-invalid:border-destructive"
              />
              {nameError && (
                <p
                  id="project-name-error"
                  role="alert"
                  className="mt-3 text-destructive"
                >
                  Enter a project name.
                </p>
              )}
              <div className="my-6 flex min-h-11 items-center gap-3">
                <Checkbox
                  id="notifications"
                  checked={notifications}
                  onCheckedChange={(checked) =>
                    setNotifications(checked === true)
                  }
                />
                <Label
                  htmlFor="notifications"
                  className="flex min-h-11 flex-1 items-center"
                >
                  Email notifications
                </Label>
              </div>
              <div className="mb-6 grid gap-3">
                <p className="break-all text-muted-foreground">{email}</p>
                <div>
                  <NotificationEmailDialog
                    email={email}
                    onSave={(next) => {
                      setEmail(next);
                      setStatus("Notification email saved");
                    }}
                  />
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
        <Card aria-labelledby="team-heading">
          <CardHeader>
            <CardTitle id="team-heading" role="heading" aria-level={2}>
              Team members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between gap-3 border-b border-border pb-6">
              <span>Jamie Davis</span>
              <span className="text-muted-foreground">Owner</span>
            </div>
            {!removed && (
              <div className="flex justify-between gap-3 py-6">
                <span>Alex Chen</span>
                <span className="text-muted-foreground">Editor</span>
              </div>
            )}
            <MemberRemovalDialog
              removed={removed}
              onRemove={() => {
                setRemoved(true);
                setStatus("Member removed");
              }}
              onRestore={() => {
                setRemoved(false);
                setStatus("Member restored");
              }}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
