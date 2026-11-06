import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";

export function MemberRemovalDialog({
  removed,
  onRemove,
  onRestore,
}: {
  removed: boolean;
  onRemove: () => void;
  onRestore: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant={removed ? "outline" : "destructive"}
          className="h-auto min-h-11 rounded-lg px-4 py-3"
          onClick={(event) => {
            if (removed) {
              event.preventDefault();
              onRestore();
            }
          }}
        >
          {removed ? "Restore member" : "Remove member"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Alex Chen?</AlertDialogTitle>
          <AlertDialogDescription>
            Alex Chen will lose access to this project. You can restore access
            afterward.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({
              variant: "destructive",
              className: "min-h-11",
            })}
            onClick={onRemove}
          >
            Remove member
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
