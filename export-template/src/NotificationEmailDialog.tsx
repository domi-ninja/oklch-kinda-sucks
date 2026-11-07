import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NotificationEmailDialog({
  email,
  onSave,
}: {
  email: string;
  onSave: (email: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(email);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const validate = (field: HTMLInputElement) =>
    !field.value.trim()
      ? "Enter an email address."
      : !field.value.includes("@")
        ? "Include an @ sign in the email address."
        : field.validity.typeMismatch
          ? "Enter a valid email address, such as name@example.com."
          : null;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDraft(email);
          setError(null);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11">
          Edit notification email
        </Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          input.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Notification email</DialogTitle>
          <DialogDescription>
            Project notifications will be sent to this address.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            // Portal events still bubble through the surrounding project form.
            event.stopPropagation();
            if (!input.current) return;
            const message = validate(input.current);
            setError(message);
            if (message) {
              input.current.focus();
              return;
            }
            onSave(draft.trim());
            setOpen(false);
          }}
        >
          <div className="grid gap-3">
            <Label htmlFor="notification-email">Email address</Label>
            <Input
              ref={input}
              id="notification-email"
              name="notification-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={draft}
              aria-invalid={!!error}
              aria-describedby={error ? "notification-email-error" : undefined}
              className="h-auto min-h-11 bg-background p-3 text-base md:text-base aria-invalid:border-destructive"
              onBlur={(event) => setError(validate(event.currentTarget))}
              onChange={(event) => {
                setDraft(event.target.value);
                if (error) setError(validate(event.currentTarget));
              }}
            />
            {error && (
              <p
                id="notification-email-error"
                role="alert"
                className="text-destructive"
              >
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="min-h-11">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" className="min-h-11">
              Save email
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
