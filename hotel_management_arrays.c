/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A hotel management system using 1D, 2D and 3D arrays.
- 1D array: weekly revenue (total and average)
- 2D array: room occupancy for one branch (5 floors x 10 rooms)
- 3D array: occupancy for 3 branches (3 x 5 x 10)
- Occupancy is simulated randomly (1 = occupied, 0 = vacant)
*/

#include <stdio.h>
#include <stdlib.h>
#include <time.h>

int main()
{
    double revenue[7], total = 0, average;
    int occupancy[5][10];
    int chain[3][5][10];
    int i, j, k, occupied, total_occupied = 0;

    srand((unsigned int)time(NULL));

    /* 1D array - weekly revenue */
    for (i = 0; i < 7; i++)
    {
        printf("Enter revenue for day %d: ", i + 1);
        scanf("%lf", &revenue[i]);
        total = total + revenue[i];
    }
    average = total / 7;

    printf("Total Weekly Revenue: %.2f\n", total);
    printf("Average Daily Revenue: %.2f\n\n", average);

    /* 2D array - one branch */
    for (i = 0; i < 5; i++)
    {
        for (j = 0; j < 10; j++)
        {
            occupancy[i][j] = rand() % 2;
        }
    }

    printf("Room Occupancy (One Branch):\n");
    for (i = 0; i < 5; i++)
    {
        occupied = 0;
        for (j = 0; j < 10; j++)
        {
            if (occupancy[i][j] == 1)
            {
                occupied++;
            }
        }
        printf("Floor %d: Occupied = %d, Vacant = %d\n", i + 1, occupied, 10 - occupied);
    }

    /* 3D array - multiple branches */
    for (i = 0; i < 3; i++)
    {
        for (j = 0; j < 5; j++)
        {
            for (k = 0; k < 10; k++)
            {
                chain[i][j][k] = rand() % 2;
                if (chain[i][j][k] == 1)
                {
                    total_occupied++;
                }
            }
        }
    }

    printf("Occupancy Across All Branches (3 branches):\n");
    printf("Total occupied rooms: %d out of 150\n", total_occupied);

    return 0;
}
