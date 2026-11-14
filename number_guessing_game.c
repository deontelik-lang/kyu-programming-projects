/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A number guessing game.
- The computer picks a random number from 1 to 20 (inclusive)
- The player guesses until correct
- Messages: Too high!, Too low!, Congratulations!
- The total number of attempts is displayed
*/

#include <stdio.h>
#include <stdlib.h>
#include <time.h>

int main()
{
    int secret, guess, attempts = 0;

    srand((unsigned int)time(NULL));
    secret = rand() % 20 + 1;

    printf("Guess the number between 1 and 20.\n");

    do
    {
        printf("Enter your guess: ");
        scanf("%d", &guess);
        attempts++;

        if (guess > secret)
        {
            printf("Too high!\n");
        }
        else if (guess < secret)
        {
            printf("Too low!\n");
        }
        else
        {
            printf("Congratulations!\n");
        }
    } while (guess != secret);

    printf("Total attempts: %d\n", attempts);

    return 0;
}
